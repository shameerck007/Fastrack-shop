"use server";

import { getCompanySettings } from "@/lib/company-settings";
import { sameOrder } from "@/lib/scan";

import { UserError, failure, unwrapAction } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateOrderStatus } from "@/lib/actions/admin-orders";
import { dispatchExpressOrder } from "@/lib/dispatch";

export async function toggleAvailability(isAvailable: boolean) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");

  const { error } = await supabase
    .from("delivery_partners")
    .update({ is_available: isAvailable })
    .eq("id", user.id);
  if (error) throw error;

  revalidatePath("/rider");

  } catch (e) {
    return failure(e) as never;
  }
}

export async function acceptOrder(orderId: string) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");

  const { data: existingActive } = await supabase
    .from("delivery_assignments")
    .select("order_id, orders!inner(status)")
    .eq("rider_id", user.id)
    .not("orders.status", "in", "(delivered,cancelled)")
    .limit(1)
    .maybeSingle();

  if (existingActive) {
    throw new UserError("Finish your current delivery before accepting a new one.");
  }

  const { error: assignError } = await supabase
    .from("delivery_assignments")
    .insert({ order_id: orderId, rider_id: user.id, assigned_at: new Date().toISOString() });

  if (assignError) {
    if (assignError.code === "23505") {
      throw new UserError("Another rider just accepted this order.");
    }
    throw assignError;
  }

  await unwrapAction(updateOrderStatus)(orderId, "rider_assigned");
  revalidatePath("/rider");

  } catch (e) {
    return failure(e) as never;
  }
}

export async function markPickedUp(orderId: string, scannedCode?: string, pickupCode?: string) {
  try {
  const supabase = await createClient();
  // When the market requires a label scan, the scanned (or typed) code must be this order's number.
  const settings = await getCompanySettings();
  // Either proof is enough: the parcel label scan, or the 4-digit pickup code the store shows. A wrong one is always refused.
  let verified = false;
  if (scannedCode) {
    const { data: o } = await supabase.from("orders").select("order_number").eq("id", orderId).maybeSingle();
    if (!o || !sameOrder(scannedCode, o.order_number)) throw new UserError("That label is for a different order. Check you have the right parcel.");
    verified = true;
  }
  if (!verified && pickupCode) {
    const { data: ok, error: codeError } = await supabase.rpc("verify_pickup_code" as never, { p_order: orderId, p_code: pickupCode } as never);
    if (codeError) throw codeError;
    if (!ok) throw new UserError("That pickup code is wrong. Ask the store for the code for this order.");
    verified = true;
  }
  if (settings.require_pickup_scan && !verified) throw new UserError("Scan the parcel label or enter the store's pickup code to confirm pickup.");
  await supabase
    .from("delivery_assignments")
    .update({ picked_up_at: new Date().toISOString() })
    .eq("order_id", orderId);
  await unwrapAction(updateOrderStatus)(orderId, "out_for_delivery");
  revalidatePath("/rider");

  } catch (e) {
    return failure(e) as never;
  }
}

/** Take a whole Standard route: every order still ready in it becomes yours. */
export async function acceptRoute(routeId: string) {
  try {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_route" as never, { p_route_id: routeId } as never);
  if (error) throw new UserError((error as { message?: string }).message || "This route is not available any more.");
  const ids = (data as unknown as (string | { accept_route?: string })[] | null) ?? [];
  for (const row of ids) {
    const orderId = typeof row === "string" ? row : row.accept_route;
    if (orderId) await unwrapAction(updateOrderStatus)(orderId, "rider_assigned");
  }
  revalidatePath("/rider");
  return await routeId;

  } catch (e) {
    return failure(e) as never;
  }
}

/** At the shop: mark every order of the route as picked up and on its way. */
export async function markRoutePickedUp(routeId: string) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");
  const { data: rows } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: { order_id: string }[] | null }> } } })
    .from("delivery_route_orders")
    .select("order_id")
    .eq("route_id", routeId);
  for (const r of rows ?? []) {
    const { data: o } = await supabase.from("orders").select("status").eq("id", r.order_id).maybeSingle();
    if (o?.status !== "rider_assigned") continue;
    await supabase.from("delivery_assignments").update({ picked_up_at: new Date().toISOString() }).eq("order_id", r.order_id).eq("rider_id", user.id);
    await unwrapAction(updateOrderStatus)(r.order_id, "out_for_delivery");
  }
  revalidatePath("/rider");
  revalidatePath(`/rider/routes/${routeId}`);

  } catch (e) {
    return failure(e) as never;
  }
}

export async function completeDelivery(orderId: string, otp: string) {
  try {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("delivery_otp")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.delivery_otp !== otp) {
    throw new UserError("Incorrect OTP. Please check with the customer and try again.");
  }

  await supabase
    .from("delivery_assignments")
    .update({ delivered_at: new Date().toISOString() })
    .eq("order_id", orderId);
  await unwrapAction(updateOrderStatus)(orderId, "delivered");
  // If this was the last stop of a Standard route, the route is complete (no-op for single orders).
  await supabase.rpc("close_route_if_done" as never, { p_order_id: orderId } as never);

  revalidatePath("/rider");
  revalidatePath(`/orders/${orderId}`);

  } catch (e) {
    return failure(e) as never;
  }
}

/** Accept a quick-delivery offer. The database checks it is still live and yours, and creates the assignment. */
export async function acceptExpressOffer(offerId: string) {
  try {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_express_offer", { p_offer_id: offerId });
  if (error) throw new UserError(error.message || "This offer is not available any more.");
  const orderId = data as unknown as string;
  await unwrapAction(updateOrderStatus)(orderId, "rider_assigned");
  revalidatePath("/rider");

  } catch (e) {
    return failure(e) as never;
  }
}

/** Decline (or let run out) an offer; the next nearest rider is offered the order straight away. */
export async function declineExpressOffer(offerId: string) {
  try {
  const supabase = await createClient();
  const { data } = await supabase.rpc("decline_express_offer", { p_offer_id: offerId });
  const orderId = data as unknown as string | null;
  if (orderId) await dispatchExpressOrder(orderId);
  revalidatePath("/rider");

  } catch (e) {
    return failure(e) as never;
  }
}
