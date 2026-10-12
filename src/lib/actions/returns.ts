"use server";

import { UserError, failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins, notifyUsers } from "@/lib/push";
import { sendRefundEmail } from "@/lib/email-notifications";

/** The functions below arrive with migration 0098, so they are called by name. */
async function call<T>(fn: string, args: object): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  return data as unknown as T;
}

function refresh(orderId?: string) {
  revalidatePath("/admin/returns");
  revalidatePath("/rider/returns");
  if (orderId) {
    revalidatePath(`/orders/${orderId}`);
    revalidatePath(`/admin/orders/${orderId}`);
  }
}

/** Customer: ask to return an item (and how many) from a delivered order. */
export async function requestReturn(orderId: string, itemId: string, quantity: number, reason: string, details: string, photos: string[]): Promise<{ returnNumber: string; status: string }> {
  try {
    if (!(quantity > 0)) throw new UserError("Choose how many to return.");
    const r = await call<{ return_number: string; status: string; order_number: string; product_name: string }>("request_return", { p_item: itemId, p_qty: quantity, p_reason: reason, p_details: details.trim() || null, p_photos: photos });
    refresh(orderId);
    await notifyAdmins({
      title: r.status === "approved" ? "Return approved: send a rider" : "New return request",
      body: `${r.product_name} from order #${r.order_number} (${r.return_number}).`,
      url: "/admin/returns",
    });
    return { returnNumber: r.return_number, status: r.status };
  } catch (e) {
    return failure(e) as never;
  }
}

/** Customer: cancel a return before the item is collected. */
export async function cancelReturn(orderId: string, returnId: string): Promise<void> {
  try {
    await call<null>("cancel_return", { p_return: returnId });
    refresh(orderId);
  } catch (e) {
    return failure(e) as never;
  }
}

/** Admin: approve (a rider collects it, or the customer keeps it and is refunded now) or reject a return. */
export async function reviewReturn(orderId: string, returnId: string, input: { approve: boolean; resolution: "pickup" | "keep"; refundDelivery: boolean; note: string }): Promise<{ status: string }> {
  try {
    const r = await call<{ status: string; user_id: string; return_number: string; order_number: string; amount?: number }>("admin_review_return", {
      p_return: returnId,
      p_approve: input.approve,
      p_resolution: input.resolution,
      p_refund_delivery: input.refundDelivery,
      p_note: input.note.trim() || null,
    });
    refresh(orderId);
    const body =
      r.status === "rejected"
        ? `Your return ${r.return_number} for order #${r.order_number} was not accepted: ${input.note.trim()}`
        : r.status === "refunded"
          ? `Your return ${r.return_number} was approved. You can keep the item and a refund is on its way.`
          : `Your return ${r.return_number} for order #${r.order_number} was approved. A rider will collect the item.`;
    await notifyUsers([r.user_id], { title: r.status === "rejected" ? "Return not accepted" : "Return approved", body, url: `/orders/${orderId}` });
    if (r.status === "refunded") await sendRefundEmail(orderId, `Return ${r.return_number}`);
    return { status: r.status };
  } catch (e) {
    return failure(e) as never;
  }
}

/** Admin: send a rider to collect an approved return. */
export async function assignReturnRider(orderId: string, returnId: string, riderId: string): Promise<void> {
  try {
    const r = await call<{ rider_id: string; return_number: string; order_number: string; user_id: string }>("admin_assign_return_rider", { p_return: returnId, p_rider: riderId });
    refresh(orderId);
    await notifyUsers([r.rider_id], { title: "Return to collect", body: `Collect return ${r.return_number} for order #${r.order_number}.`, url: "/rider/returns" });
    await notifyUsers([r.user_id], { title: "A rider is on the way", body: `A rider will collect your return ${r.return_number}. Have the item ready and show them your return code.`, url: `/orders/${orderId}` });
  } catch (e) {
    return failure(e) as never;
  }
}

/** Rider: confirm the collection with the customer's code. The item is refunded at that moment. */
export async function confirmReturnPickup(returnId: string, code: string): Promise<{ ok: boolean }> {
  try {
    const r = await call<{ ok: boolean; user_id?: string; return_number?: string; order_number?: string; amount?: number; order_id?: string }>("rider_confirm_return_pickup", { p_return: returnId, p_code: code });
    if (!r.ok) throw new UserError("That code is not right. Ask the customer for the code shown on their order page.");
    refresh();
    // Tell the supplier or warehouse that the item is on its way to them.
    try {
      const supabase = await createClient();
      const { data: to } = await supabase.rpc("return_dropoff_recipients" as never, { p_return: returnId } as never);
      const ids = ((to ?? []) as unknown as { user_id: string }[]).map((x) => x.user_id);
      if (ids.length) await notifyUsers(ids, { title: "A return is on its way to you", body: `Return ${r.return_number} (order #${r.order_number}) has been collected and is coming back.`, url: "/" });
    } catch {
      // the notice is a courtesy; the return itself already succeeded
    }
    if (r.user_id) {
      await notifyUsers([r.user_id], { title: "Return collected", body: `We collected your return ${r.return_number} and your refund is on its way.`, url: "/orders" });
    }
    return { ok: true };
  } catch (e) {
    return failure(e) as never;
  }
}

/** The supplier, the warehouse, or an admin checks the returned item in. Good condition puts the units back into stock. */
export async function receiveReturn(returnId: string, condition: "good" | "damaged", note: string): Promise<void> {
  try {
    await call<unknown>("receive_return", { p_return: returnId, p_condition: condition, p_note: note.trim() || null });
    refresh();
    revalidatePath("/merchant/returns");
    revalidatePath("/warehouse/returns");
    revalidatePath("/merchant/products");
    revalidatePath("/warehouse/stock");
  } catch (e) {
    return failure(e) as never;
  }
}
