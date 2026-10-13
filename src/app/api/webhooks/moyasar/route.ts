import { NextResponse } from "next/server";
import { recordProviderResult } from "@/lib/payment-finalize";

/**
 * Moyasar calls this when a payment changes (paid, failed, refunded). It is only a nudge: the shared secret in the call is
 * checked, the payment is then looked up at Moyasar itself, and the checkout is marked paid or failed. Orders are placed
 * when the shopper returns to the app (or, if they never do, the payment is refunded by the sweep).
 */
function sameSecret(given: unknown, expected: string): boolean {
  if (typeof given !== "string" || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  const secret = process.env.MOYASAR_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { secret_token?: string; id?: string; data?: { id?: string } } | null;
  if (!body || !sameSecret(body.secret_token, secret)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const paymentId = body.data?.id ?? body.id;
  if (paymentId && /^[0-9a-f-]{36}$/i.test(paymentId)) await recordProviderResult(paymentId).catch(() => {});
  return NextResponse.json({ ok: true });
}
