import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchPayment, moyasarKeys, refundPayment, toHalalas } from "@/lib/moyasar";

const ONLINE = ["mada", "visa", "mastercard", "apple_pay"];

/**
 * Sends money back to the customer's card when an order that was paid online is cancelled or refunded.
 * `amount` is the part to return; leave it out to return the order's whole payment (a cancellation). Cash on Delivery orders are
 * skipped (nothing was collected online). One card payment can cover several suppliers' orders, so only this order's share is
 * refunded, and never more than what is still left on the payment. Returns a short text for the admin, or null when nothing was due.
 */
export async function refundOnlinePayment(orderId: string, amount?: number): Promise<string | null> {
  const db = createServiceClient();
  const { data } = await db.from("payments").select("id, method, status, amount, provider_reference").eq("order_id", orderId).maybeSingle();
  const pay = data as { id: string; method: string; status: string; amount: number; provider_reference: string | null } | null;
  if (!pay || !ONLINE.includes(pay.method) || pay.status !== "paid" || !pay.provider_reference) return null;
  if (!moyasarKeys()) return "This order was paid online but the payment provider is not configured, so the money was not returned to the card.";
  try {
    const remote = await fetchPayment(pay.provider_reference);
    const left = remote.amount - (remote.refunded ?? 0);
    const want = Math.min(toHalalas(amount ?? Number(pay.amount)), left);
    if (want <= 0) return null;
    await refundPayment(pay.provider_reference, want);
    if (want >= toHalalas(Number(pay.amount))) await db.from("payments").update({ status: "refunded" }).eq("id", pay.id);
    return `SAR ${(want / 100).toFixed(2)} was returned to the customer's card.`;
  } catch (e) {
    return `The refund could not be sent to the card (${e instanceof Error ? e.message : "provider error"}). Refund it from the Moyasar dashboard.`;
  }
}
