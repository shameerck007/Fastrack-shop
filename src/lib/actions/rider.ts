"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateOrderStatus } from "@/lib/actions/admin-orders";

export async function markPickedUp(orderId: string) {
  const supabase = await createClient();
  await supabase
    .from("delivery_assignments")
    .update({ picked_up_at: new Date().toISOString() })
    .eq("order_id", orderId);
  await updateOrderStatus(orderId, "out_for_delivery");
  revalidatePath("/rider");
}

export async function completeDelivery(orderId: string, otp: string) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("delivery_otp")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.delivery_otp !== otp) {
    throw new Error("Incorrect OTP. Please check with the customer and try again.");
  }

  await supabase
    .from("delivery_assignments")
    .update({ delivered_at: new Date().toISOString() })
    .eq("order_id", orderId);
  await updateOrderStatus(orderId, "delivered");

  revalidatePath("/rider");
  revalidatePath(`/orders/${orderId}`);
}
