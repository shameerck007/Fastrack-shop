import "server-only";

/**
 * The server's side of Moyasar (the Saudi payment provider): look a payment up, refund it, charge a saved card.
 * Needs three secrets, set with `wrangler secret put`, never in the code:
 *   MOYASAR_PUBLISHABLE_KEY  (pk_...)  also sent to the browser; it can only start a payment
 *   MOYASAR_SECRET_KEY       (sk_...)  server only; can read and refund payments
 *   MOYASAR_WEBHOOK_SECRET             the shared secret Moyasar puts in each webhook call
 * Without the first two, online payment is simply not offered at checkout.
 */
const API = "https://api.moyasar.com/v1";

export function moyasarKeys() {
  const publishable = process.env.MOYASAR_PUBLISHABLE_KEY;
  const secret = process.env.MOYASAR_SECRET_KEY;
  return publishable && secret ? { publishable, secret } : null;
}

export const onlinePaymentsEnabled = (countryCode: string | null | undefined) => (countryCode ?? "SA") === "SA" && !!moyasarKeys();

export interface MoyasarPayment {
  id: string;
  status: "initiated" | "paid" | "authorized" | "failed" | "refunded" | "captured" | "voided" | "verified" | "expired";
  /** In halalas: 100 = SAR 1.00. */
  amount: number;
  currency: string;
  refunded?: number;
  description?: string | null;
  metadata?: Record<string, string> | null;
  source?: {
    type?: string;
    company?: string;
    name?: string | null;
    number?: string | null;
    token?: string | null;
    message?: string | null;
    transaction_url?: string | null;
  };
}

function auth(key: string) {
  return `Basic ${btoa(`${key}:`)}`;
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const keys = moyasarKeys();
  if (!keys) throw new Error("Online payment is not set up yet.");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: auth(keys.secret), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string; errors?: unknown };
  if (!res.ok) throw new Error(typeof json.message === "string" ? json.message : `Payment provider error (${res.status}).`);
  return json;
}

/** Always read the payment from Moyasar itself (never trust what the browser or a webhook body says). */
export const fetchPayment = (id: string) => call<MoyasarPayment>("GET", `/payments/${encodeURIComponent(id)}`);

export const refundPayment = (id: string, halalas?: number) => call<MoyasarPayment>("POST", `/payments/${encodeURIComponent(id)}/refund`, halalas ? { amount: halalas } : {});

/** Pay with a saved card. The security code is passed straight through, never stored. Returns where the shopper confirms with their bank. */
export const chargeSavedCard = (p: { token: string; cvc: string; halalas: number; currency: string; description: string; callbackUrl: string; givenId: string; metadata: Record<string, string> }) =>
  call<MoyasarPayment>("POST", "/payments", {
    amount: p.halalas,
    currency: p.currency,
    description: p.description,
    callback_url: p.callbackUrl,
    given_id: p.givenId,
    metadata: p.metadata,
    source: { type: "token", token: p.token, cvc: p.cvc, "3ds": true },
  });

export const toHalalas = (amount: number) => Math.round(amount * 100);
