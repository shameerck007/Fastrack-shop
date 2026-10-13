/**
 * The browser's side of paying with Moyasar. The card number goes from the shopper's phone straight to Moyasar over HTTPS with the
 * publishable key (which can only start a payment); our servers never see it. Everything else (what is owed, the order, the
 * check that the money really arrived) is done by our server, never trusted from here.
 */
import { digitsOnly, parseExpiry, type CardInput } from "@/lib/card";

const API = "https://api.moyasar.com/v1";

export interface PaymentStart {
  sessionId: string;
  halalas: number;
  currency: string;
  publishableKey: string;
}

interface MoyasarResponse {
  id?: string;
  status?: string;
  message?: string;
  errors?: Record<string, string[]>;
  source?: { transaction_url?: string | null; message?: string | null };
}

const basic = (key: string) => `Basic ${btoa(`${key}:`)}`;

export const callbackUrlFor = (sessionId: string) => `${window.location.origin}/pay/return?s=${sessionId}`;

function explain(r: MoyasarResponse): string {
  const first = r.errors ? Object.values(r.errors).flat()[0] : null;
  return first || r.source?.message || r.message || "Your bank declined the payment. Nothing was charged.";
}

async function post(start: PaymentStart, source: Record<string, unknown>): Promise<MoyasarResponse> {
  const res = await fetch(`${API}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: basic(start.publishableKey) },
    body: JSON.stringify({
      given_id: start.sessionId,
      amount: start.halalas,
      currency: start.currency,
      description: "FasTrack order",
      callback_url: callbackUrlFor(start.sessionId),
      metadata: { session: start.sessionId },
      source,
    }),
  });
  return (await res.json().catch(() => ({}))) as MoyasarResponse;
}

/** Sends a new card. Returns the page to open: the bank's confirmation page, or straight back to us when no confirmation is needed. */
export async function submitCard(start: PaymentStart, card: CardInput, saveCard: boolean): Promise<{ paymentId: string; next: string }> {
  const exp = parseExpiry(card.expiry);
  if (!exp) throw new Error("Enter the expiry as MM/YY.");
  const r = await post(start, {
    type: "creditcard",
    name: card.name.trim().replace(/\s+/g, " "),
    number: digitsOnly(card.number),
    cvc: digitsOnly(card.cvc),
    month: String(exp.month).padStart(2, "0"),
    year: String(exp.year),
    "3ds": true,
    save_card: saveCard,
  });
  if (!r.id || r.status === "failed") throw new Error(explain(r));
  return { paymentId: r.id, next: r.source?.transaction_url || `${callbackUrlFor(start.sessionId)}&id=${r.id}` };
}

// ---- Apple Pay -------------------------------------------------------------------------------------------------

interface ApplePaySessionLike {
  begin(): void;
  abort(): void;
  completeMerchantValidation(merchantSession: unknown): void;
  completePayment(status: number): void;
  onvalidatemerchant: ((e: { validationURL: string }) => void) | null;
  onpaymentauthorized: ((e: { payment: { token: unknown } }) => void) | null;
  oncancel: (() => void) | null;
  STATUS_SUCCESS: number;
  STATUS_FAILURE: number;
}
type ApplePayCtor = (new (version: number, request: unknown) => ApplePaySessionLike) & { canMakePayments(): boolean; STATUS_SUCCESS: number; STATUS_FAILURE: number };

const applePay = (): ApplePayCtor | null => ((window as unknown as { ApplePaySession?: ApplePayCtor }).ApplePaySession ?? null);

/** True on an iPhone, iPad or Mac with Safari and a card in Wallet. */
export function applePayAvailable(): boolean {
  try {
    const A = applePay();
    return !!A && A.canMakePayments();
  } catch {
    return false;
  }
}

/**
 * Apple Pay. `open` must be called straight from the shopper's tap (Apple requires that), so the amount shown on the sheet is the one the
 * checkout displays, and `start` (asks our server what is owed and opens the payment) runs afterwards; if the two differ the sheet is closed.
 */
export function payWithApplePay(p: { displayTotal: number; start: () => Promise<PaymentStart>; saveCard: boolean }): Promise<{ next: string; paymentId: string }> {
  return new Promise((resolve, reject) => {
    const A = applePay();
    if (!A) return reject(new Error("Apple Pay is not available on this device."));
    const session = new A(6, {
      countryCode: "SA",
      currencyCode: "SAR",
      supportedNetworks: ["visa", "masterCard", "mada"],
      merchantCapabilities: ["supports3DS", "supportsCredit", "supportsDebit"],
      total: { label: "FasTrack", amount: p.displayTotal.toFixed(2) },
    });
    let started: PaymentStart | null = null;
    session.onvalidatemerchant = async (e) => {
      try {
        started = await p.start();
        if (started.halalas !== Math.round(p.displayTotal * 100)) throw new Error("The total changed. Please check your cart and try again.");
        const res = await fetch(`${API}/applepay/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ validation_url: e.validationURL, display_name: "FasTrack", domain_name: window.location.hostname, publishable_api_key: started.publishableKey }),
        });
        if (!res.ok) throw new Error("Apple Pay could not be started.");
        session.completeMerchantValidation(await res.json());
      } catch (err) {
        session.abort();
        reject(err instanceof Error ? err : new Error("Apple Pay could not be started."));
      }
    };
    session.onpaymentauthorized = async (e) => {
      try {
        if (!started) throw new Error("Apple Pay could not be started.");
        const r = await post(started, { type: "applepay", token: e.payment.token, save_card: p.saveCard });
        if (!r.id || r.status === "failed") throw new Error(explain(r));
        session.completePayment(session.STATUS_SUCCESS ?? A.STATUS_SUCCESS);
        resolve({ paymentId: r.id, next: r.source?.transaction_url || `${callbackUrlFor(started.sessionId)}&id=${r.id}` });
      } catch (err) {
        session.completePayment(session.STATUS_FAILURE ?? A.STATUS_FAILURE);
        reject(err instanceof Error ? err : new Error("The payment did not go through."));
      }
    };
    session.oncancel = () => reject(new Error("cancelled"));
    session.begin();
  });
}
