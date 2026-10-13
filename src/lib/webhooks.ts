import { createServiceClient } from "@/lib/supabase/service";
import { publicSku } from "@/lib/supplier-sync";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const WEBHOOK_EVENTS = ["order.created", "order.picked_up", "order.delivered", "order.cancelled", "return.requested"] as const;

/** A webhook must be a public https address. Private, local and raw-IP addresses are refused (the shop must never be made to call its own network). */
export function validateWebhookUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Enter a full web address, like https://your-system.com/fastrack." };
  }
  if (u.protocol !== "https:") return { ok: false, error: "The address must start with https://" };
  if (u.username || u.password) return { ok: false, error: "Do not put a user name or password in the address." };
  if (u.port && u.port !== "443") return { ok: false, error: "Use the standard https port (443)." };
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost") || host === "localhost") {
    return { ok: false, error: "The address must be a public website name." };
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[")) return { ok: false, error: "Use a website name, not an IP number." };
  if (raw.length > 500) return { ok: false, error: "The address is too long." };
  return { ok: true, url: u.toString() };
}

export function newWebhookSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `whsec_${btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface QueuedEvent {
  id: string;
  store_id: string;
  event: string;
  order_id: string | null;
  return_id: string | null;
  attempts: number;
  url: string;
  secret: string;
}

/** The JSON a supplier receives. Built from the current order, with only that supplier's own items. */
async function buildPayload(db: any, ev: { id: string; store_id: string; event: string; order_id: string | null; return_id: string | null }) {
  const base = { id: ev.id, event: ev.event, created_at: new Date().toISOString() };
  if (ev.event === "webhook.test") {
    return { ...base, data: { order_number: "FT00000", status: "confirmed", items: [{ sku: "EXAMPLE-SKU", name: "Example product", variant_label: "1 kg", quantity: 1, unit_price: 10 }], note: "This is a test message from FasTrack." } };
  }
  if (!ev.order_id) return null;
  const { data: order } = await db.from("orders").select("order_number, status, created_at, currency, delivery_type").eq("id", ev.order_id).maybeSingle();
  if (!order) return null;
  const { data: items } = await db
    .from("order_items")
    .select("product_name, variant_label, ordered_quantity, packed_quantity, unit_price, line_total, product_variants!order_items_variant_id_fkey!inner(products!inner(sku, store_id))")
    .eq("order_id", ev.order_id)
    .eq("product_variants.products.store_id", ev.store_id);
  const data: Record<string, unknown> = {
    order_number: order.order_number,
    status: order.status,
    placed_at: order.created_at,
    currency: order.currency,
    delivery_type: order.delivery_type,
    items: (items ?? []).map((r: any) => ({
      sku: publicSku(ev.store_id, r.product_variants?.products?.sku ?? null),
      name: r.product_name,
      variant_label: r.variant_label,
      quantity: Number(r.ordered_quantity),
      packed_quantity: r.packed_quantity == null ? null : Number(r.packed_quantity),
      unit_price: Number(r.unit_price),
      line_total: Number(r.line_total),
    })),
  };
  if (ev.return_id) {
    const { data: ret } = await db.from("order_returns").select("return_number, quantity, reason, status, order_items(product_name, variant_label)").eq("id", ev.return_id).maybeSingle();
    if (ret) data.return = { return_number: ret.return_number, quantity: Number(ret.quantity), reason: ret.reason, status: ret.status, item: ret.order_items?.product_name ?? null, variant_label: ret.order_items?.variant_label ?? null };
  }
  return { ...base, data };
}

/** POSTs one message, signed. Success = any 2xx within 8 seconds. Redirects are not followed. */
export async function deliverWebhook(url: string, secret: string, id: string, event: string, payload: unknown): Promise<{ ok: boolean; status: number; error?: string }> {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await hmacHex(secret, `${timestamp}.${body}`);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        "user-agent": "FasTrack-Webhooks/1",
        "x-fastrack-event": event,
        "x-fastrack-delivery": id,
        "x-fastrack-timestamp": timestamp,
        "x-fastrack-signature": `sha256=${signature}`,
      },
      body,
    });
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: res.status >= 300 && res.status < 400 ? "Your address redirected; give the final address." : `Your system answered ${res.status}.` };
  } catch (e) {
    return { ok: false, status: 0, error: ctl.signal.aborted ? "No answer within 8 seconds." : e instanceof Error ? e.message.slice(0, 150) : "Could not connect." };
  } finally {
    clearTimeout(timer);
  }
}

/** Called every minute: sends due messages and records the outcome (the database schedules the retries). */
export async function processWebhookQueue(): Promise<{ sent: number; failed: number }> {
  const db: any = createServiceClient();
  const { data, error } = await db.rpc("claim_webhook_events", { p_limit: 25 });
  if (error || !data) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  await Promise.all(
    (data as QueuedEvent[]).map(async (ev) => {
      let result: { ok: boolean; status: number; error?: string };
      const check = validateWebhookUrl(ev.url);
      if (!check.ok) {
        result = { ok: false, status: 0, error: check.error };
      } else {
        const payload = await buildPayload(db, ev);
        result = payload ? await deliverWebhook(check.url, ev.secret, ev.id, ev.event, payload) : { ok: true, status: 0 }; // the order is gone: nothing to send
      }
      await db.rpc("finish_webhook_event", { p_id: ev.id, p_ok: result.ok, p_status: result.status, p_error: result.error ?? null });
      if (result.ok) sent++;
      else failed++;
    })
  );
  await db.rpc("drop_orphan_webhook_events");
  return { sent, failed };
}

export async function sendTestMessage(url: string, secret: string) {
  const id = crypto.randomUUID();
  const payload = await buildPayload(null, { id, store_id: "", event: "webhook.test", order_id: null, return_id: null });
  return deliverWebhook(url, secret, id, "webhook.test", payload);
}
