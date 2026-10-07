"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateOrderStatus } from "@/lib/actions/admin-orders";
import { dispatchExpressOrder } from "@/lib/dispatch";

export async function toggleAvailability(isAvailable: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const { error } = await supabase
    .from("delivery_partners")
    .update({ is_available: isAvailable })
    .eq("id", user.id);
  if (error) throw error;

  revalidatePath("/rider");
}

export async function acceptOrder(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const { data: existingActive } = await supabase
    .from("delivery_assignments")
    .select("order_id, orders!inner(status)")
    .eq("rider_id", user.id)
    .not("orders.status", "in", "(delivered,cancelled)")
    .limit(1)
    .maybeSingle();

  if (existingActive) {
    throw new Error("Finish your current delivery before accepting a new one.");
  }

  const { error: assignError } = await supabase
    .from("delivery_assignments")
    .insert({ order_id: orderId, rider_id: user.id, assigned_at: new Date().toISOString() });

  if (assignError) {
    if (assignError.code === "23505") {
      throw new Error("Another rider just accepted this order.");
    }
    throw assignError;
  }

  await updateOrderStatus(orderId, "rider_assigned");
  revalidatePath("/rider");
}

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

/** Accept a quick-delivery offer. The database checks it is still live and yours, and creates the assignment. */
export async function acceptExpressOffer(offerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_express_offer", { p_offer_id: offerId });
  if (error) throw new Error(error.message || "This offer is not available any more.");
  const orderId = data as unknown as string;
  await updateOrderStatus(orderId, "rider_assigned");
  revalidatePath("/rider");
}

/** Decline (or let run out) an offer; the next nearest rider is offered the order straight away. */
export async function declineExpressOffer(offerId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("decline_express_offer", { p_offer_id: offerId });
  const orderId = data as unknown as string | null;
  if (orderId) await dispatchExpressOrder(orderId);
  revalidatePath("/rider");
}
