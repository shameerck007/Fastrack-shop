"use server";


import { UserError, failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyOrderStatusChange, notifyNearbyRidersOfNewOrder } from "@/lib/push";
import { dispatchExpressOrder } from "@/lib/dispatch";
import { sendOrderStatusEmail } from "@/lib/email-notifications";
import type { OrderStatus } from "@/types/database";

// Same shape as advanceMerchantOrderStatus — the "warehouse staff advance
// their orders" RLS policy (0031) is the real boundary (only this staff
// account's warehouse, only pending/confirmed/preparing -> next stage);
// this allowlist is just a clear-error UX guard.
const ALLOWED_NEXT: Record<string, OrderStatus> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready_for_pickup",
};

export async function advanceWarehouseOrderStatus(orderId: string, currentStatus: OrderStatus) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");

  const next = ALLOWED_NEXT[currentStatus];
  if (!next) throw new UserError("This order can't be advanced from its current status.");

  const { data, error } = await supabase
    .from("orders")
    .update({ status: next })
    .eq("id", orderId)
    .eq("status", currentStatus)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new UserError("This order already moved on — refresh and try again.");
  }

  await supabase.from("order_status_history").insert({ order_id: orderId, status: next });
  await notifyOrderStatusChange(orderId, next);
  await sendOrderStatusEmail(orderId, next);
  if (next === "ready_for_pickup") await notifyNearbyRidersOfNewOrder(orderId);
  // Express: start offering to riders as soon as packing begins, so one is close by when it is ready.
  else if (next === "preparing") await dispatchExpressOrder(orderId);

  revalidatePath("/warehouse/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/admin/orders");

  } catch (e) {
    return failure(e) as never;
  }
}

export async function updateWarehouseStock(inventoryId: string, stock: number) {
  try {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory").update({ stock }).eq("id", inventoryId);
  if (error) throw error;
  revalidatePath("/warehouse/stock");

  } catch (e) {
    return failure(e) as never;
  }
}
