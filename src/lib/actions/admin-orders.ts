"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyOrderStatusChange } from "@/lib/push";
import { sendOrderStatusEmail } from "@/lib/email-notifications";
import type { OrderStatus } from "@/types/database";

// Covers every admin-driven status change AND every rider action
// (acceptOrder/markPickedUp/completeDelivery all call this) — the one
// place to notify the customer without duplicating the push/email call at
// each call site.
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = await createClient();

  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;

  await supabase.from("order_status_history").insert({ order_id: orderId, status });
  await notifyOrderStatusChange(orderId, status);
  await sendOrderStatusEmail(orderId, status);

  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);
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
