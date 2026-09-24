"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = await createClient();

  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;

  await supabase.from("order_status_history").insert({ order_id: orderId, status });

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
