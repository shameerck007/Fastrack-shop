"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCartItems } from "@/lib/cart";
import { getVariantStockMap } from "@/lib/inventory";
import { checkProductsDeliverable, resolveProductWarehouses } from "@/lib/delivery-zones";
import { combineMethods, deliveryFee as deliveryFeeFor, pricingFor } from "@/lib/delivery-methods";
import { getCurrentTenant } from "@/lib/tenant-server";
import { SERVICE_AREA_MESSAGE, stateInServiceArea } from "@/lib/india";
import { assertStoresOpen } from "@/lib/stores";
import { addToCart } from "@/lib/actions/cart";
import { notifyUsers } from "@/lib/push";
import { sendOrderConfirmationEmail, sendNewOrderEmails } from "@/lib/email-notifications";
import { generateOrderNumber, generateOtp } from "@/lib/utils";
import { deliveryTaxRate, extractTax, productTaxRate } from "@/lib/tax";
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
  // Delivery fees are per market (SAR in Saudi Arabia, INR in India), charged per supplier order.
  const orderTenant = await getCurrentTenant();
  const pricing = pricingFor(orderTenant?.country_code);
  // Tax is computed per item from each product's own rate (GST slabs in India, VAT in Saudi).
  const taxCountry = orderTenant?.country_code ?? "SA";
  const itemTaxes = items.map((item) => {
    const rate = productTaxRate(item.product_variants.products, taxCountry);
    const gross = Math.round(item.quantity * item.product_variants.price * 100) / 100;
    return { rate, tax: extractTax(gross, rate) };
  });

  // Fetched before warehouse resolution — for FasTrack's own items (no
  // store_id), which of FasTrack's own locations fulfils the order now
  // depends on the customer's coordinates (nearest location whose delivery
  // boundary covers them), not a single fixed "default" warehouse.
  const { data: chosenAddress } = await supabase
    .from("addresses")
    .select("lat, lng, state")
    .eq("id", input.addressId)
    .maybeSingle();
  if (!stateInServiceArea(orderTenant?.country_code, (chosenAddress as { state?: string | null } | null)?.state)) {
    throw new Error(SERVICE_AREA_MESSAGE);
  }
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

  // Each shipment (one per supplier) gets its own delivery method, decided here from where it is going:
  // Express when every item in that shipment is inside its shop's Express area, otherwise Standard.
  // The shopper's only input is "scheduled" (a Standard slot). Anything else is decided by the system.
  const methodsOfItems = (idxs: number[]) =>
    combineMethods(idxs.map((i) => deliverability.get(items[i].product_variants.products.id)?.methods).filter((m): m is NonNullable<typeof m> => !!m));

  // The order records the market it was placed in, so receipts and reports stay correct per country.
  const tenant = orderTenant;
  const orderCountry = tenant?.country_code ?? "SA";

  // One order per supplier: each shop prepares, invoices and hands over its own parcel, and gets
  // its own rider, OTP, GST invoice and settlement. The delivery fee is charged per order.
  const groups = new Map<string, number[]>();
  items.forEach((item, idx) => {
    const key = item.product_variants.products.store_id ?? "own";
    groups.set(key, [...(groups.get(key) ?? []), idx]);
  });

  // Check every shipment can go before anything is placed, so an order is never half-created for a method problem.
  const typeByGroup = new Map<string, DeliveryType>();
  for (const [key, idxs] of groups) {
    const m = methodsOfItems(idxs);
    if (input.deliveryType === "scheduled") {
      if (!m.standard) throw new Error("Scheduled delivery isn't available for part of your cart at this address. Choose delivery as soon as possible or another address.");
      typeByGroup.set(key, "scheduled");
    } else if (m.express) {
      typeByGroup.set(key, "express");
    } else if (m.standard) {
      typeByGroup.set(key, "standard");
    } else {
      throw new Error("We can't deliver part of your cart to this address. Please remove those items or choose another address.");
    }
  }

  const placedIds: string[] = [];
  try {
    for (const [groupKey, idxs] of groups) {
      const groupType = typeByGroup.get(groupKey) ?? "standard";
      const groupItems = idxs.map((i) => items[i]);
      const groupSubtotal = Math.round(groupItems.reduce((sum, it) => sum + it.quantity * it.product_variants.price, 0) * 100) / 100;
      const deliveryFee = deliveryFeeFor(groupType, groupSubtotal, pricing);
      // Tax inside the order = the items' tax, plus GST inside the delivery charge where it applies (India).
      const vat = Math.round((idxs.reduce((sum, i) => sum + itemTaxes[i].tax, 0) + extractTax(deliveryFee, deliveryTaxRate(taxCountry))) * 100) / 100;
      const total = Math.round((groupSubtotal + deliveryFee) * 100) / 100;

      const orderNumber = generateOrderNumber();
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          user_id: user.id,
          address_id: input.addressId,
          // The single pickup warehouse of this supplier's parcel (rider pickup instructions).
          warehouse_id: itemWarehouseIds[idxs[0]] ?? null,
          status: "pending",
          currency: tenant?.currency ?? "SAR",
          country_code: orderCountry,
          tax_label: orderCountry === "IN" ? "GST" : "VAT",
          delivery_type: groupType,
          scheduled_for: groupType === "scheduled" ? input.scheduledFor : null,
          subtotal: groupSubtotal,
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
      placedIds.push(order.id);

      const orderItems = idxs.map((i) => {
        const item = items[i];
        return {
          tax_rate: itemTaxes[i].rate,
          tax_amount: itemTaxes[i].tax,
          hsn_code: item.product_variants.products.hsn_code ?? null,
          order_id: order.id,
          variant_id: item.variant_id,
          product_name: item.product_variants.products.name,
          variant_label: item.product_variants.label,
          ordered_quantity: item.quantity,
          unit_price: item.product_variants.price,
          line_total: Math.round(item.quantity * item.product_variants.price * 100) / 100,
        };
      });

      let { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      // Per-item tax columns arrive with migration 0047; until it's applied, save the lines without them.
      if (itemsError && (itemsError.code === "42703" || itemsError.code === "PGRST204")) {
        ({ error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems.map(({ tax_rate: _r, tax_amount: _a, hsn_code: _h, ...rest }) => rest)));
      }
      if (itemsError) throw itemsError;

      for (const i of idxs) {
        const item = items[i];
        const { error: stockError } = await supabase.rpc("decrement_stock", {
          p_variant_id: item.variant_id,
          p_warehouse_id: itemWarehouseIds[i],
          p_qty: item.quantity,
        });
        if (stockError) {
          throw new Error(`${item.product_variants.products.name} sold out while placing your order. Please remove it and try again.`);
        }
      }

      await supabase.from("order_status_history").insert({ order_id: order.id, status: "pending" });

      // Tell whoever prepares this parcel: the supplier's owner, or FasTrack's warehouse staff.
      const storeId = groupItems[0].product_variants.products.store_id;
      if (storeId) {
        const { data: storeOwners } = await supabase.from("stores").select("owner_id").eq("id", storeId);
        const ownerIds = (storeOwners ?? []).map((s) => s.owner_id);
        await notifyUsers(ownerIds, { title: "New order received", body: `Order #${orderNumber} needs confirmation.`, url: "/merchant/orders" });
        await sendNewOrderEmails(ownerIds, orderNumber, "/merchant/orders");
      } else {
        const ownWarehouseId = itemWarehouseIds[idxs[0]];
        const { data: staffRows } = await supabase.from("warehouse_staff").select("user_id").eq("warehouse_id", ownWarehouseId);
        const staffIds = (staffRows ?? []).map((s) => s.user_id);
        await notifyUsers(staffIds, { title: "New order received", body: `Order #${orderNumber} needs confirmation.`, url: "/warehouse/orders" });
        await sendNewOrderEmails(staffIds, orderNumber, "/warehouse/orders");
      }
      await sendOrderConfirmationEmail(order.id);

      await supabase.from("payments").insert({
        order_id: order.id,
        method: input.paymentMethod,
        status: input.paymentMethod === "cash_on_delivery" ? "pending" : "authorized",
        amount: total,
      });

      // This supplier's lines are ordered: take them out of the cart right away, so a failure
      // on a later supplier never leaves already-placed items to be ordered twice.
      await supabase.from("cart_items").delete().in("id", groupItems.map((it) => it.id));
    }
  } catch (err) {
    const digest = (err as { digest?: string } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err;
    const message = err instanceof Error ? err.message : "Could not place your order.";
    if (placedIds.length > 0) {
      throw new Error(`${placedIds.length} of your ${groups.size} orders were placed (see My orders). The rest is still in your cart: ${message}`);
    }
    throw err;
  }

  // One supplier: straight to that order. Several: the orders list shows them all.
  redirect(placedIds.length === 1 ? `/orders/${placedIds[0]}` : "/orders");
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
