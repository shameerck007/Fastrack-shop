"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { generateOrderNumber, generateOtp } from "@/lib/utils";
import type { DeliveryType, PaymentMethod } from "@/types/database";

const VAT_RATE = 0.15;
const FREE_DELIVERY_THRESHOLD = 50;
const DELIVERY_FEES: Record<DeliveryType, number> = {
  express: 12,
  standard: 7,
  scheduled: 7,
};

export async function placeOrder(input: {
  addressId: string;
  deliveryType: DeliveryType;
  scheduledFor?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const items = await getCartItems();
  if (items.length === 0) throw new Error("Your cart is empty.");

  const subtotal = cartSubtotal(items);
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEES[input.deliveryType];
  const vat = Math.round(subtotal * VAT_RATE * 100) / 100;
  const total = Math.round((subtotal + deliveryFee + vat) * 100) / 100;

  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: generateOrderNumber(),
      user_id: user.id,
      address_id: input.addressId,
      warehouse_id: warehouse?.id ?? null,
      status: "pending",
      delivery_type: input.deliveryType,
      scheduled_for: input.deliveryType === "scheduled" ? input.scheduledFor : null,
      subtotal,
      delivery_fee: deliveryFee,
      discount: 0,
      vat,
      total,
      delivery_otp: generateOtp(),
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (orderError) throw orderError;

  const orderItems = items.map((item) => ({
    order_id: order.id,
    variant_id: item.variant_id,
    product_name: item.product_variants.products.name,
    variant_label: item.product_variants.label,
    ordered_quantity: item.quantity,
    unit_price: item.product_variants.price,
    line_total: Math.round(item.quantity * item.product_variants.price * 100) / 100,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) throw itemsError;

  await supabase.from("order_status_history").insert({ order_id: order.id, status: "pending" });

  await supabase.from("payments").insert({
    order_id: order.id,
    method: input.paymentMethod,
    status: input.paymentMethod === "cash_on_delivery" ? "pending" : "authorized",
    amount: total,
  });

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (cart) {
    await supabase.from("cart_items").delete().eq("cart_id", cart.id);
  }

  redirect(`/orders/${order.id}`);
}
