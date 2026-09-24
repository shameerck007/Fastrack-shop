"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { getVariantStockMap } from "@/lib/inventory";
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

  // Re-validate stock at checkout time — the cart page only warns, this is
  // the actual gate. decrement_stock() below is the race-safe check for
  // concurrent checkouts; this pass just gives an early, specific error
  // instead of a generic failure partway through order creation.
  const stockMap = await getVariantStockMap(items.map((item) => item.variant_id));
  const shortItems = items.filter((item) => item.quantity > (stockMap.get(item.variant_id) ?? 0));
  if (shortItems.length > 0) {
    const names = shortItems.map((item) => item.product_variants.products.name).join(", ");
    throw new Error(`Not enough stock for: ${names}. Please update your cart.`);
  }

  const subtotal = cartSubtotal(items);
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEES[input.deliveryType];
  const vat = Math.round(subtotal * VAT_RATE * 100) / 100;
  const total = Math.round((subtotal + deliveryFee + vat) * 100) / 100;

  // Resolve which warehouse actually stocks each item. Merchant products
  // live in that merchant's own warehouse (created on store approval); a
  // single hardcoded/first-active warehouse doesn't work once more than one
  // warehouse exists — that previously caused mixed admin+merchant carts to
  // decrement stock against the wrong warehouse (spurious "sold out"
  // errors, or worse, silently decrementing the wrong inventory row).
  const storeIds = [...new Set(items.map((i) => i.product_variants.products.store_id).filter((id): id is string => !!id))];
  // stores' own RLS only lets the owner (or admin) read a row — a customer
  // checking out has no access — so this goes through a SECURITY DEFINER
  // function that exposes just the store->warehouse mapping checkout needs.
  const { data: stores } = storeIds.length
    ? await supabase.rpc("get_store_warehouses", { target_store_ids: storeIds })
    : { data: [] as { store_id: string; warehouse_id: string | null }[] };
  const storeWarehouseMap = new Map(
    ((stores ?? []) as { store_id: string; warehouse_id: string | null }[]).map((s) => [s.store_id, s.warehouse_id])
  );

  const { data: warehouses } = await supabase.from("warehouses").select("id").eq("is_active", true);
  const merchantWarehouseIds = new Set([...storeWarehouseMap.values()].filter(Boolean));
  const defaultWarehouseId =
    (warehouses ?? []).find((w) => !merchantWarehouseIds.has(w.id))?.id ?? warehouses?.[0]?.id ?? null;

  const itemWarehouseIds = items.map((item) => {
    const storeId = item.product_variants.products.store_id;
    if (storeId) {
      const warehouseId = storeWarehouseMap.get(storeId);
      if (!warehouseId) {
        throw new Error(`${item.product_variants.products.name} isn't available from its seller right now.`);
      }
      return warehouseId;
    }
    return defaultWarehouseId;
  });

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: generateOrderNumber(),
      user_id: user.id,
      address_id: input.addressId,
      // orders currently support a single pickup warehouse; for a cart
      // spanning multiple sellers this records the first item's warehouse
      // (rider pickup instructions reflect that one), since fulfillment
      // splitting across sellers is intentionally out of scope for now.
      warehouse_id: itemWarehouseIds[0] ?? null,
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

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemWarehouseId = itemWarehouseIds[i];
    if (!itemWarehouseId) continue;
    const { error: stockError } = await supabase.rpc("decrement_stock", {
      p_variant_id: item.variant_id,
      p_warehouse_id: itemWarehouseId,
      p_qty: item.quantity,
    });
    if (stockError) {
      throw new Error(
        `${item.product_variants.products.name} sold out while placing your order. Please remove it and try again.`
      );
    }
  }

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
