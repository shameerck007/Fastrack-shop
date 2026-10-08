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

/** Take a whole Standard route: every order still ready in it becomes yours. */
export async function acceptRoute(routeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_route" as never, { p_route_id: routeId } as never);
  if (error) throw new Error((error as { message?: string }).message || "This route is not available any more.");
  const ids = (data as unknown as (string | { accept_route?: string })[] | null) ?? [];
  for (const row of ids) {
    const orderId = typeof row === "string" ? row : row.accept_route;
    if (orderId) await updateOrderStatus(orderId, "rider_assigned");
  }
  revalidatePath("/rider");
  return routeId;
}

/** At the shop: mark every order of the route as picked up and on its way. */
export async function markRoutePickedUp(routeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");
  const { data: rows } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: { order_id: string }[] | null }> } } })
    .from("delivery_route_orders")
    .select("order_id")
    .eq("route_id", routeId);
  for (const r of rows ?? []) {
    const { data: o } = await supabase.from("orders").select("status").eq("id", r.order_id).maybeSingle();
    if (o?.status !== "rider_assigned") continue;
    await supabase.from("delivery_assignments").update({ picked_up_at: new Date().toISOString() }).eq("order_id", r.order_id).eq("rider_id", user.id);
    await updateOrderStatus(r.order_id, "out_for_delivery");
  }
  revalidatePath("/rider");
  revalidatePath(`/rider/routes/${routeId}`);
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
  // If this was the last stop of a Standard route, the route is complete (no-op for single orders).
  await supabase.rpc("close_route_if_done" as never, { p_order_id: orderId } as never);

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
