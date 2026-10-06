"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { getVariantStockMap } from "@/lib/inventory";
import { checkProductsDeliverable, resolveProductWarehouses } from "@/lib/delivery-zones";
import { combineMethods, deliveryFee as deliveryFeeFor, pricingFor } from "@/lib/delivery-methods";
import { getCurrentTenant } from "@/lib/tenant-server";
import { assertStoresOpen } from "@/lib/stores";
import { addToCart } from "@/lib/actions/cart";
import { notifyUsers } from "@/lib/push";
import { sendOrderConfirmationEmail, sendNewOrderEmails } from "@/lib/email-notifications";
import { generateOrderNumber, generateOtp } from "@/lib/utils";
import { extractTax, productTaxRate } from "@/lib/tax";
import type { DeliveryType, PaymentMethod } from "@/types/database";


async function placeOrderOrThrow(input: {
  addressId: string;
  deliveryType: DeliveryType;
  scheduledFor?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}) {
  // No payment gateway is wired up yet — the checkout UI only offers Cash
  // on Delivery, but enforce it here too rather than trusting the client.
  if (input.paymentMethod !== "cash_on_delivery") {
    throw new Error("Only Cash on Delivery is available right now.");
  }

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

  // Product prices are VAT-inclusive (what's shown in the catalog is what
  // the item costs) — vat here is the tax portion already inside subtotal,
  // extracted for the receipt/ZATCA breakdown, not added on top.
  const subtotal = cartSubtotal(items);
  // Delivery fees are per market (SAR in Saudi Arabia, INR in India).
  const orderTenant = await getCurrentTenant();
  const deliveryFee = deliveryFeeFor(input.deliveryType, subtotal, pricingFor(orderTenant?.country_code));
  // Tax is computed per item from each product's own rate (GST slabs in India, VAT in Saudi).
  const taxCountry = orderTenant?.country_code ?? "SA";
  const itemTaxes = items.map((item) => {
    const rate = productTaxRate(item.product_variants.products, taxCountry);
    const gross = Math.round(item.quantity * item.product_variants.price * 100) / 100;
    return { rate, tax: extractTax(gross, rate) };
  });
  const vat = Math.round(itemTaxes.reduce((sum, t) => sum + t.tax, 0) * 100) / 100;
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;

  // Fetched before warehouse resolution — for FasTrack's own items (no
  // store_id), which of FasTrack's own locations fulfils the order now
  // depends on the customer's coordinates (nearest location whose delivery
  // boundary covers them), not a single fixed "default" warehouse.
  const { data: chosenAddress } = await supabase
    .from("addresses")
    .select("lat, lng")
    .eq("id", input.addressId)
    .maybeSingle();
  const coords = chosenAddress ? { lat: chosenAddress.lat, lng: chosenAddress.lng } : null;

  // Resolve which warehouse actually stocks each item. Merchant products
  // live in that merchant's own warehouse (created on store approval);
  // FasTrack's own products resolve to whichever FasTrack location covers
  // this address (resolveProductWarehouses — same function
  // checkProductsDeliverable below uses, so the warehouse stock gets
  // decremented from is guaranteed to be the same one the zone check ran
  // against, not two independently-resolved warehouses drifting apart.
  const productRefs = items.map((i) => ({
    id: i.product_variants.products.id,
    store_id: i.product_variants.products.store_id,
    name: i.product_variants.products.name,
  }));
  // The real gate for opening hours: a cart can sit through a shop's closing
  // time, so every supplier in it is re-checked at the moment of ordering.
  await assertStoresOpen(productRefs.map((p) => p.store_id));

  const warehouseByProduct = await resolveProductWarehouses(productRefs, coords);

  const itemWarehouseIds = items.map((item) => {
    const warehouseId = warehouseByProduct.get(item.product_variants.products.id) ?? null;
    if (!warehouseId) {
      throw new Error(`${item.product_variants.products.name} isn't available from its seller right now.`);
    }
    return warehouseId;
  });

  // Delivery boundary: every item's seller must deliver to the chosen address.
  const deliverability = await checkProductsDeliverable(productRefs, coords);
  const blocked = [...deliverability.values()].filter((d) => d.message);
  if (blocked.length > 0) {
    throw new Error(
      `We can't deliver some items to this address: ${blocked.map((d) => d.message).join(" ")} Please remove them or choose another address.`
    );
  }

  // The chosen delivery method must be offered for every item at this address: Express only
  // inside the express radius, Standard (and Scheduled, which is a Standard slot) where Standard applies.
  const offered = combineMethods([...deliverability.values()].map((d) => d.methods));
  if (input.deliveryType === "express" && !offered.express) {
    throw new Error("Express delivery isn't available for this address. Please choose Standard delivery.");
  }
  if (input.deliveryType !== "express" && !offered.standard) {
    throw new Error("Standard delivery isn't available for this address. Please choose Express delivery or another address.");
  }

  // The order records the market it was placed in, so receipts and reports stay correct per country.
  const tenant = orderTenant;
  const orderCountry = tenant?.country_code ?? "SA";

  const orderNumber = generateOrderNumber();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: user.id,
      address_id: input.addressId,
      // orders currently support a single pickup warehouse; for a cart
      // spanning multiple sellers this records the first item's warehouse
      // (rider pickup instructions reflect that one), since fulfillment
      // splitting across sellers is intentionally out of scope for now.
      warehouse_id: itemWarehouseIds[0] ?? null,
      status: "pending",
      currency: tenant?.currency ?? "SAR",
      country_code: orderCountry,
      tax_label: orderCountry === "IN" ? "GST" : "VAT",
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

  const orderItems = items.map((item, idx) => ({
    tax_rate: itemTaxes[idx].rate,
    tax_amount: itemTaxes[idx].tax,
    hsn_code: item.product_variants.products.hsn_code ?? null,
    order_id: order.id,
    variant_id: item.variant_id,
    product_name: item.product_variants.products.name,
    variant_label: item.product_variants.label,
    ordered_quantity: item.quantity,
    unit_price: item.product_variants.price,
    line_total: Math.round(item.quantity * item.product_variants.price * 100) / 100,
  }));

  let { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  // Per-item tax columns arrive with migration 0047; until it's applied, save the lines without them.
  if (itemsError && (itemsError.code === "42703" || itemsError.code === "PGRST204")) {
    ({ error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems.map(({ tax_rate: _r, tax_amount: _a, hsn_code: _h, ...rest }) => rest)));
  }
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

  // Tell whoever needs to prep this order that it exists — the merchant(s)
  // whose products are in it, and the FasTrack warehouse staff if any item
  // is FasTrack's own (same single-warehouse simplification as
  // itemWarehouseIds[0] above: one order, one own-warehouse notified).
  const distinctStoreIds = [...new Set(productRefs.filter((p) => p.store_id).map((p) => p.store_id as string))];
  if (distinctStoreIds.length > 0) {
    const { data: storeOwners } = await supabase.from("stores").select("owner_id").in("id", distinctStoreIds);
    const ownerIds = (storeOwners ?? []).map((s) => s.owner_id);
    await notifyUsers(ownerIds, {
      title: "New order received",
      body: `Order #${orderNumber} needs confirmation.`,
      url: "/merchant/orders",
    });
    await sendNewOrderEmails(ownerIds, orderNumber, "/merchant/orders");
  }
  const ownWarehouseIndex = productRefs.findIndex((p) => !p.store_id);
  const ownWarehouseId = ownWarehouseIndex >= 0 ? itemWarehouseIds[ownWarehouseIndex] : null;
  if (ownWarehouseId) {
    const { data: staffRows } = await supabase.from("warehouse_staff").select("user_id").eq("warehouse_id", ownWarehouseId);
    const staffIds = (staffRows ?? []).map((s) => s.user_id);
    await notifyUsers(staffIds, {
      title: "New order received",
      body: `Order #${orderNumber} needs confirmation.`,
      url: "/warehouse/orders",
    });
    await sendNewOrderEmails(staffIds, orderNumber, "/warehouse/orders");
  }
  await sendOrderConfirmationEmail(order.id);

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

/** Amazon-style "Buy it again": re-adds every item from a past order to the
 * cart in one go. Best-effort per line — an item that's now out of stock,
 * discontinued, or outside the current delivery area is skipped rather
 * than failing the whole reorder, and the skipped count is reported back
 * so the UI can say "2 of 3 items added" instead of silently dropping
 * items or hard-failing on the first problem. */
export async function reorderItems(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, order_items(variant_id, ordered_quantity)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.user_id !== user.id) throw new Error("Order not found.");

  let added = 0;
  let skipped = 0;
  for (const item of order.order_items as { variant_id: string; ordered_quantity: number }[]) {
    try {
      const result = await addToCart(item.variant_id, item.ordered_quantity);
      if (result.error) skipped++;
      else added++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/cart");
  return { added, skipped };
}

/** Same reason as addToCart: expected refusals (closed shop, no stock, outside
 * the delivery area...) come back as { error } so the real message survives
 * production. On success placeOrderOrThrow redirects, which must propagate. */
export async function placeOrder(input: Parameters<typeof placeOrderOrThrow>[0]): Promise<{ error: string }> {
  try {
    await placeOrderOrThrow(input);
    return { error: "" };
  } catch (err) {
    const digest = (err as { digest?: string } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err;
    return { error: err instanceof Error ? err.message : "Could not place your order." };
  }
}
