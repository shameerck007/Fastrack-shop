import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { placeOrderOrThrow, type PlaceOrderInput } from "@/lib/place-order";
import { fetchPayment, refundPayment, toHalalas, moyasarKeys, type MoyasarPayment } from "@/lib/moyasar";
import { detectBrand, paymentMethodFor, type CardBrand } from "@/lib/card";
import { friendlyMessage } from "@/lib/errors";
import type { PaymentMethod } from "@/types/database";

/**
 * Turns a confirmed online payment into orders. One session = one checkout; this runs from three places (the shopper's return
 * from the bank, the shopper's next visit if they closed the app mid-payment, and the webhook marks it paid), so it is
 * written to be safe to run twice at the same time: only one caller can claim the session, the others see the result.
 *
 * Money rules: an order is only created for a payment Moyasar itself reports as paid, for exactly the session's amount.
 * If the order then cannot be created (an item just sold out, prices changed) the payment is refunded straight away.
 */
export type Outcome =
  | { state: "placed"; orderIds: string[]; note?: string }
  | { state: "pending" }
  | { state: "failed"; message: string }
  | { state: "refunded"; message: string };

interface SessionRow {
  id: string;
  tenant_id: string;
  user_id: string;
  input: PlaceOrderInput;
  amount: number;
  currency: string;
  save_card: boolean;
  status: string;
  provider_payment_id: string | null;
  order_ids: string[];
  error: string | null;
}

const COLS = "id, tenant_id, user_id, input, amount, currency, save_card, status, provider_payment_id, order_ids, error";
const nowIso = () => new Date().toISOString();

function methodOf(p: MoyasarPayment): PaymentMethod {
  if (p.source?.type === "applepay") return "apple_pay";
  const company = (p.source?.company ?? "").toLowerCase();
  const brand: CardBrand = company === "mada" ? "mada" : company === "master" || company === "mastercard" ? "mastercard" : company === "visa" ? "visa" : detectBrand(p.source?.number ?? "");
  return paymentMethodFor(brand);
}

/** Looks the payment up at Moyasar and checks it really is a paid payment for this session's amount. */
async function verified(session: SessionRow, paymentId: string): Promise<{ ok: true; payment: MoyasarPayment } | { ok: false; failed: boolean; message: string }> {
  const payment = await fetchPayment(paymentId);
  if (payment.metadata?.session && payment.metadata.session !== session.id) return { ok: false, failed: true, message: "This payment belongs to a different checkout." };
  if (payment.status === "paid" || payment.status === "captured") {
    if (payment.amount !== toHalalas(session.amount) || payment.currency.toUpperCase() !== session.currency.toUpperCase()) {
      return { ok: false, failed: true, message: "The amount paid does not match your order." };
    }
    return { ok: true, payment };
  }
  if (payment.status === "failed" || payment.status === "expired" || payment.status === "voided") {
    return { ok: false, failed: true, message: payment.source?.message || "Your bank declined the payment. Nothing was charged." };
  }
  return { ok: false, failed: false, message: "" };
}

/** Called by the webhook: records the result at Moyasar without placing anything (no shopper is signed in here). */
export async function recordProviderResult(paymentId: string): Promise<void> {
  const db = createServiceClient();
  const early = await fetchPayment(paymentId);
  const sessionId = early.metadata?.session;
  if (!sessionId) return;
  const { data } = await db.from("payment_sessions").select(COLS).eq("id", sessionId).maybeSingle();
  const session = data as SessionRow | null;
  if (!session) return;
  const v = await verified(session, paymentId);
  if (v.ok) {
    await db.from("payment_sessions").update({ status: "paid", provider_payment_id: paymentId, updated_at: nowIso() }).eq("id", session.id).in("status", ["created", "initiated"]);
  } else if (v.failed) {
    await db.from("payment_sessions").update({ status: "failed", provider_payment_id: paymentId, error: v.message, updated_at: nowIso() }).eq("id", session.id).in("status", ["created", "initiated"]);
  }
}

/** Confirms the payment and places the orders. Must run as the signed-in shopper who started the checkout. */
export async function finalizeSession(sessionId: string, paymentId: string | null): Promise<Outcome> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { state: "failed", message: "Please sign in again to finish your order." };
  const db = createServiceClient();
  const { data } = await db.from("payment_sessions").select(COLS).eq("id", sessionId).eq("user_id", user.id).maybeSingle();
  const session = data as SessionRow | null;
  if (!session) return { state: "failed", message: "We could not find that payment." };

  if (session.status === "placed") return { state: "placed", orderIds: session.order_ids };
  if (session.status === "refunded") return { state: "refunded", message: session.error ?? "Your payment was refunded." };
  if (session.status === "failed") return { state: "failed", message: session.error ?? "The payment did not go through." };

  const payId = paymentId ?? session.provider_payment_id;
  if (!payId) return { state: "pending" };

  const v = await verified(session, payId);
  if (!v.ok) {
    if (!v.failed) return { state: "pending" };
    await db.from("payment_sessions").update({ status: "failed", provider_payment_id: payId, error: v.message, updated_at: nowIso() }).eq("id", session.id).in("status", ["created", "initiated", "paid"]);
    return { state: "failed", message: v.message };
  }

  // Claim the session. A claim abandoned five minutes ago (the server stopped mid-way) can be taken over.
  const stale = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: claimed } = await db
    .from("payment_sessions")
    .update({ status: "placing", provider_payment_id: payId, updated_at: nowIso() })
    .eq("id", session.id)
    .or(`status.in.(created,initiated,paid),and(status.eq.placing,updated_at.lt.${stale})`)
    .select("id");
  if (!claimed || claimed.length === 0) {
    const { data: again } = await db.from("payment_sessions").select(COLS).eq("id", session.id).maybeSingle();
    const a = again as SessionRow | null;
    return a?.status === "placed" ? { state: "placed", orderIds: a.order_ids } : { state: "pending" };
  }

  try {
    const placed = await placeOrderOrThrow(session.input, { paid: { reference: payId, method: methodOf(v.payment), amount: Number(session.amount) } });
    await db.from("payment_sessions").update({ status: "placed", order_ids: placed.orderIds, updated_at: nowIso() }).eq("id", session.id);
    if (session.save_card) await saveCardFrom(v.payment, session).catch(() => {});
    return { state: "placed", orderIds: placed.orderIds };
  } catch (e) {
    const message = friendlyMessage(e, "We could not place your order.");
    const partialIds = (e as { partialIds?: string[] } | null)?.partialIds;
    if (partialIds?.length) {
      // Some suppliers' orders were placed: keep those, and refund only the part that was not.
      const { data: done } = await db.from("orders").select("total").in("id", partialIds);
      const placedHalalas = ((done ?? []) as { total: number }[]).reduce((n, o) => n + toHalalas(Number(o.total)), 0);
      const rest = toHalalas(Number(session.amount)) - placedHalalas;
      let refundedNote = "";
      if (rest > 0) {
        try {
          await refundPayment(payId, rest);
          refundedNote = ` The rest of your payment was refunded.`;
        } catch {
          refundedNote = ` The rest of your payment is being refunded.`;
        }
      }
      await db.from("payment_sessions").update({ status: "placed", order_ids: partialIds, error: message, updated_at: nowIso() }).eq("id", session.id);
      if (session.save_card) await saveCardFrom(v.payment, session).catch(() => {});
      return { state: "placed", orderIds: partialIds, note: `${message}${refundedNote}` };
    }
    try {
      await refundPayment(payId);
      await db.from("payment_sessions").update({ status: "refunded", error: `${message} Your payment has been refunded.`, updated_at: nowIso() }).eq("id", session.id);
      return { state: "refunded", message: `${message} Your payment has been refunded; it can take a few days to show on your card.` };
    } catch {
      // The refund itself failed: leave the session as paid so the sweep retries it, and tell the shopper plainly.
      await db.from("payment_sessions").update({ status: "paid", error: message, updated_at: nowIso() }).eq("id", session.id);
      return { state: "failed", message: `${message} Your payment is being refunded; contact support if it does not appear in a few days.` };
    }
  }
}

/** Keeps the card for next time: the provider's token plus what is needed to recognise the card. Never the number or code. */
async function saveCardFrom(payment: MoyasarPayment, session: SessionRow) {
  const token = payment.source?.token;
  if (!token || !token.startsWith("token_")) return;
  const db = createServiceClient();
  const keys = moyasarKeys();
  let month: number | null = null;
  let year: number | null = null;
  if (keys) {
    const res = await fetch(`https://api.moyasar.com/v1/tokens/${encodeURIComponent(token)}`, { headers: { Authorization: `Basic ${btoa(`${keys.secret}:`)}` } }).catch(() => null);
    const t = res && res.ok ? ((await res.json().catch(() => null)) as { month?: string | number; year?: string | number } | null) : null;
    if (t) {
      month = Number(t.month) || null;
      year = Number(t.year) || null;
      if (year && year < 100) year += 2000;
    }
  }
  const last4 = (payment.source?.number ?? "").replace(/\D/g, "").slice(-4);
  if (!/^\d{4}$/.test(last4)) return;
  const company = (payment.source?.company ?? "").toLowerCase();
  const brand = company === "master" ? "mastercard" : company || "card";
  const { count } = await db.from("saved_cards").select("id", { count: "exact", head: true }).eq("user_id", session.user_id);
  await db.from("saved_cards").upsert(
    { tenant_id: session.tenant_id, user_id: session.user_id, token, brand, last4, exp_month: month, exp_year: year, holder_name: payment.source?.name ?? null, is_default: (count ?? 0) === 0 },
    { onConflict: "user_id,token", ignoreDuplicates: true },
  );
}

/**
 * Housekeeping, run every minute with the other cron work:
 *  - a payment confirmed more than 10 minutes ago whose orders were never placed (the shopper closed the app and never came back,
 *    or the placing failed) is refunded, so nobody is left having paid for nothing;
 *  - checkouts that were never paid are marked expired after an hour.
 */
export async function sweepPayments(): Promise<{ refunded: number; expired: number }> {
  if (!moyasarKeys()) return { refunded: 0, expired: 0 };
  const db = createServiceClient();
  const tenMin = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: stuck } = await db.from("payment_sessions").select("id, provider_payment_id").in("status", ["paid", "placing"]).lt("updated_at", tenMin).not("provider_payment_id", "is", null).limit(20);
  let refunded = 0;
  for (const s of (stuck ?? []) as { id: string; provider_payment_id: string }[]) {
    try {
      await refundPayment(s.provider_payment_id);
      await db.from("payment_sessions").update({ status: "refunded", error: "The order was not completed, so your payment was refunded.", updated_at: nowIso() }).eq("id", s.id);
      refunded++;
    } catch {
      /* tried again next minute */
    }
  }
  const hour = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: old } = await db.from("payment_sessions").update({ status: "expired", updated_at: nowIso() }).in("status", ["created", "initiated"]).lt("created_at", hour).select("id");
  return { refunded, expired: old?.length ?? 0 };
}
