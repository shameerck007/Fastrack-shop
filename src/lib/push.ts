import { createClient } from "@/lib/supabase/server";
import { sendWebPush, type PushSubscriptionKeys, type VapidConfig } from "@/lib/web-push";
import type { OrderStatus } from "@/types/database";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:support@fastrack.cloud" };
}

type SubRow = { user_id: string; endpoint: string; p256dh: string; auth: string };

async function sendToSubscriptions(subs: SubRow[], payload: PushPayload) {
  if (subs.length === 0) return;
  const vapid = getVapidConfig();
  // Push isn't configured yet (no VAPID keys set) — never break the
  // order/status flow that triggered this; just skip sending silently.
  if (!vapid) return;

  const supabase = await createClient();
  await Promise.all(
    subs.map(async (sub) => {
      const keys: PushSubscriptionKeys = { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth };
      try {
        const result = await sendWebPush(keys, payload, vapid);
        if (result.expired) {
          await supabase.rpc("delete_push_subscription", { target_endpoint: sub.endpoint });
        }
      } catch {
        // Best-effort: one subscriber's failed push (network blip, a
        // malformed/revoked subscription) never breaks the caller's flow.
      }
    })
  );
}

/** Pushes to every subscribed device of the given users. */
export async function notifyUsers(userIds: string[], payload: PushPayload) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { data } = await supabase.rpc("push_subscriptions_for_users", { target_user_ids: ids });
  await sendToSubscriptions((data ?? []) as SubRow[], payload);
}

/** Pushes to every admin's subscribed devices. */
export async function notifyAdmins(payload: PushPayload) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("push_subscriptions_for_admins");
  await sendToSubscriptions((data ?? []) as SubRow[], payload);
}

const STATUS_MESSAGE: Partial<Record<OrderStatus, { title: string; body: string }>> = {
  confirmed: { title: "Order confirmed", body: "Order #{n} has been confirmed and is being prepared." },
  preparing: { title: "Preparing your order", body: "Order #{n} is being packed." },
  ready_for_pickup: { title: "Ready for pickup", body: "Order #{n} is packed and waiting for a rider." },
  rider_assigned: { title: "Rider on the way", body: "A rider has been assigned to order #{n}." },
  out_for_delivery: { title: "Out for delivery", body: "Order #{n} is on its way to you." },
  delivered: { title: "Delivered", body: "Order #{n} has been delivered. Enjoy!" },
  cancelled: { title: "Order cancelled", body: "Order #{n} has been cancelled." },
};

/** Notifies the customer who placed `orderId` that its status changed. Call
 * this from every place order.status actually changes — currently
 * admin-orders.ts (covers admin + all rider actions), merchant-orders.ts,
 * and warehouse-staff.ts. */
export async function notifyOrderStatusChange(orderId: string, status: OrderStatus) {
  const template = STATUS_MESSAGE[status];
  if (!template) return;

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("user_id, order_number").eq("id", orderId).maybeSingle();
  if (!order) return;

  await notifyUsers([order.user_id], {
    title: template.title,
    body: template.body.replace("{n}", order.order_number),
    url: `/orders/${orderId}`,
  });
}
