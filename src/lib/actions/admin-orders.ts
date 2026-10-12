"use server";


import { UserError, failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyOrderStatusChange, notifyUsers, notifyNearbyRidersOfNewOrder } from "@/lib/push";
import { dispatchExpressOrder } from "@/lib/dispatch";
import { sendOrderStatusEmail, sendOrderCancelledSellerEmails, sendRefundEmail } from "@/lib/email-notifications";
import type { OrderStatus } from "@/types/database";

// Covers every admin-driven status change AND every rider action
// (acceptOrder/markPickedUp/completeDelivery all call this) — the one
// place to notify the customer without duplicating the push/email call at
// each call site.
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  try {
  const supabase = await createClient();

  const { data: previous } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();

  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;

  await supabase.from("order_status_history").insert({ order_id: orderId, status });
  await notifyOrderStatusChange(orderId, status);
  await sendOrderStatusEmail(orderId, status);
  if (status === "cancelled" && previous?.status !== "cancelled") {
    await notifySellersOfCancellation(orderId);
    await restockCancelledOrder(orderId);
  }
  if (status === "ready_for_pickup") await notifyNearbyRidersOfNewOrder(orderId);
  else if (status === "preparing") await dispatchExpressOrder(orderId);

  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);

  } catch (e) {
    return failure(e) as never;
  }
}

// A merchant or FasTrack warehouse's staff were already told a new order
// needed their confirmation (orders.ts, placeOrder) — if it's cancelled
// afterward, without this they'd keep prepping something that no longer
// exists. Same "one order, one own-warehouse" simplification the rest of
// this codebase uses (order.warehouse_id is set once, at placement).
async function notifySellersOfCancellation(orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("order_number, warehouse_id").eq("id", orderId).maybeSingle();
  if (!order) return;

  const { data: itemRows } = await supabase
    .from("order_items")
    .select("variant_id, product_variants!variant_id(products(store_id))")
    .eq("order_id", orderId);

  type ItemRow = { product_variants: { products: { store_id: string | null } | null } | null };
  const rows = (itemRows ?? []) as unknown as ItemRow[];
  const storeIds = [...new Set(rows.map((r) => r.product_variants?.products?.store_id).filter((id): id is string => !!id))];
  const hasOwnItem = rows.some((r) => r.product_variants?.products && r.product_variants.products.store_id === null);

  if (storeIds.length > 0) {
    const { data: storeOwners } = await supabase.from("stores").select("owner_id").in("id", storeIds);
    const ownerIds = (storeOwners ?? []).map((s) => s.owner_id);
    await notifyUsers(ownerIds, {
      title: "Order cancelled",
      body: `Order #${order.order_number} has been cancelled.`,
      url: "/merchant/orders",
    });
    await sendOrderCancelledSellerEmails(ownerIds, order.order_number, "/merchant/orders");
  }
  if (hasOwnItem && order.warehouse_id) {
    const { data: staffRows } = await supabase.from("warehouse_staff").select("user_id").eq("warehouse_id", order.warehouse_id);
    const staffIds = (staffRows ?? []).map((s) => s.user_id);
    await notifyUsers(staffIds, {
      title: "Order cancelled",
      body: `Order #${order.order_number} has been cancelled.`,
      url: "/warehouse/orders",
    });
    await sendOrderCancelledSellerEmails(staffIds, order.order_number, "/warehouse/orders");
  }
}

// placeOrder (orders.ts) decrements stock per line item via decrement_stock;
// cancelling must give it back. Same "one order, one own-warehouse"
// simplification as notifySellersOfCancellation above: every item is
// restocked against order.warehouse_id, the warehouse it was decremented
// from at placement.
async function restockCancelledOrder(orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("warehouse_id").eq("id", orderId).maybeSingle();
  if (!order?.warehouse_id) return;

  const { data: itemRows } = await supabase.from("order_items").select("variant_id, ordered_quantity").eq("order_id", orderId);
  for (const item of itemRows ?? []) {
    await supabase.rpc("increment_stock", {
      p_variant_id: item.variant_id,
      p_warehouse_id: order.warehouse_id,
      p_qty: item.ordered_quantity,
    });
  }
}

// No payment gateway exists yet (only Cash on Delivery is supported), so a refund is a record of money returned to the customer outside
// the app. It is itemised: the admin chooses which items and how many (and whether the delivery fee goes back). The database reverses
// what the supplier was paid, FasTrack's commission, any supplier-funded discount and the tax inside, in the same proportion,
// and the customer is told on every channel.
export async function refundOrder(orderId: string, items: { orderItemId: string; quantity: number }[], refundDelivery: boolean, reason: string): Promise<{ amount: number; full: boolean }> {
  try {
    const supabase = await createClient();
    const chosen = items.filter((i) => i.quantity > 0).map((i) => ({ order_item_id: i.orderItemId, quantity: i.quantity }));
    const { data, error } = await supabase.rpc("admin_refund_order" as never, { p_order: orderId, p_items: chosen, p_delivery: refundDelivery, p_reason: reason.trim() } as never);
    if (error) throw error;
    const r = data as { amount: number; full: boolean; user_id: string; order_number: string };

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/admin/settlements");
    await notifyUsers([r.user_id], {
      title: "Refund processed",
      body: reason.trim() ? `A refund has been processed for order #${r.order_number}: ${reason.trim()}` : `A refund has been processed for order #${r.order_number}.`,
      url: `/orders/${orderId}`,
    });
    await sendRefundEmail(orderId, reason.trim());
    return { amount: Number(r.amount), full: !!r.full };
  } catch (e) {
    return failure(e) as never;
  }
}

export async function assignRider(orderId: string, riderId: string) {
  try {
  const supabase = await createClient();

  const { error } = await supabase.from("delivery_assignments").upsert(
    { order_id: orderId, rider_id: riderId, assigned_at: new Date().toISOString() },
    { onConflict: "order_id" }
  );
  if (error) throw error;

  await updateOrderStatus(orderId, "rider_assigned");

  } catch (e) {
    return failure(e) as never;
  }
}

// Rider pay when an order goes wrong: pay the rider for a failed delivery (a cancelled order), or deduct from the rider after a refund. Never automatic.
export async function adjustRiderPay(orderId: string, kind: "failed_delivery" | "refund_clawback", amount: number, note: string): Promise<{ amount: number }> {
  try {
    if (!(amount > 0)) throw new UserError("Enter an amount greater than zero.");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_rider_order_adjustment" as never, { p_order: orderId, p_kind: kind, p_amount: amount, p_note: note.trim() || null } as never);
    if (error) throw error;
    const r = data as { rider_id: string; order_number: string; amount: number };
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/rider-settlements");
    revalidatePath(`/admin/rider-settlements/${r.rider_id}`);
    await notifyUsers([r.rider_id], {
      title: kind === "failed_delivery" ? "Paid for a failed delivery" : "Deduction recorded",
      body: kind === "failed_delivery" ? `You were paid for order #${r.order_number}, which could not be delivered.` : `A deduction was recorded for the refund on order #${r.order_number}.`,
      url: "/rider/earnings",
    });
    return { amount: Number(r.amount) };
  } catch (e) {
    return failure(e) as never;
  }
}
