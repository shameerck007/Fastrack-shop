"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyOrderStatusChange, notifyUsers, notifyNearbyRidersOfNewOrder } from "@/lib/push";
import { sendOrderStatusEmail, sendOrderCancelledSellerEmails, sendRefundEmail } from "@/lib/email-notifications";
import type { OrderStatus } from "@/types/database";

// Covers every admin-driven status change AND every rider action
// (acceptOrder/markPickedUp/completeDelivery all call this) — the one
// place to notify the customer without duplicating the push/email call at
// each call site.
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
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

  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);
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

// No payment gateway exists yet (only Cash on Delivery is supported — see
// placeOrder), so this is a manual record, not an automated money-back
// transaction: admin marks the order as refunded (cash returned or waived
// outside the app) and the customer gets notified on all three channels.
export async function markOrderRefunded(orderId: string, reason: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .update({ status: "refunded" })
    .eq("order_id", orderId)
    .neq("status", "refunded")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This order has no payment record, or was already refunded.");

  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);

  const { data: order } = await supabase.from("orders").select("user_id, order_number").eq("id", orderId).maybeSingle();
  if (order) {
    await notifyUsers([order.user_id], {
      title: "Refund processed",
      body: reason ? `A refund has been processed for order #${order.order_number}: ${reason}` : `A refund has been processed for order #${order.order_number}.`,
      url: `/orders/${orderId}`,
    });
  }
  await sendRefundEmail(orderId, reason);
}

export async function assignRider(orderId: string, riderId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("delivery_assignments").upsert(
    { order_id: orderId, rider_id: riderId, assigned_at: new Date().toISOString() },
    { onConflict: "order_id" }
  );
  if (error) throw error;

  await updateOrderStatus(orderId, "rider_assigned");
}
