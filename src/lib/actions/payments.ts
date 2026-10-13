"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UserError, failure } from "@/lib/errors";
import { getCurrentTenant } from "@/lib/tenant-server";
import { placeOrderOrThrow, type PlaceOrderInput } from "@/lib/place-order";
import { chargeSavedCard, moyasarKeys, onlinePaymentsEnabled, toHalalas } from "@/lib/moyasar";
import { cvcProblem, type CardBrand } from "@/lib/card";

/** What the checkout needs to know about each saved card. The provider's token never leaves the server. */
export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  holderName: string | null;
  isDefault: boolean;
}

type Input = Pick<PlaceOrderInput, "addressId" | "deliveryType" | "scheduledFor" | "notes" | "offerCode">;

async function originOf(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Works out what the shopper owes for their cart right now and opens a payment session for it. The orders do not exist yet. */
async function openSession(input: Input, saveCard: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");
  const tenant = await getCurrentTenant();
  if (!onlinePaymentsEnabled(tenant?.country_code)) throw new UserError("Online payment is not available yet. Please choose Cash on Delivery.");

  const stored: PlaceOrderInput = { ...input, paymentMethod: "cash_on_delivery", offerCode: input.offerCode ?? null };
  const { total } = await placeOrderOrThrow(stored, { quoteOnly: true });
  if (!(total > 0)) throw new UserError("There is nothing to pay for.");
  const { data, error } = await supabase
    .from("payment_sessions" as never)
    .insert({ user_id: user.id, input: stored, amount: total, currency: tenant?.currency ?? "SAR", save_card: saveCard, method: "card" } as never)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Could not start the payment.");
  return { id: (data as { id: string }).id, total, currency: tenant?.currency ?? "SAR" };
}

/** Card or Apple Pay: the browser sends the payment to Moyasar itself (the card number never touches our server). */
export async function startOnlinePayment(input: Input, saveCard: boolean) {
  try {
    const keys = moyasarKeys();
    if (!keys) throw new UserError("Online payment is not available yet.");
    const s = await openSession(input, saveCard);
    return { sessionId: s.id, halalas: toHalalas(s.total), currency: s.currency, publishableKey: keys.publishable };
  } catch (e) {
    return failure(e) as never;
  }
}

/** Saved card: we charge it from the server with the code the shopper just typed (not stored), then send them to their bank to confirm. */
export async function payWithSavedCard(input: Input, cardId: string, cvc: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("You must be logged in.");
    const db = createServiceClient();
    const { data: card } = await db.from("saved_cards").select("token, brand").eq("id", cardId).eq("user_id", user.id).maybeSingle();
    if (!card) throw new UserError("That card is no longer saved. Choose another way to pay.");
    const problem = cvcProblem(cvc, (card.brand === "amex" ? "amex" : "visa") as CardBrand);
    if (problem) throw new UserError(problem);

    const s = await openSession(input, false);
    const origin = await originOf();
    const callback = `${origin}/pay/return?s=${s.id}`;
    const payment = await chargeSavedCard({
      token: card.token as string,
      cvc,
      halalas: toHalalas(s.total),
      currency: s.currency,
      description: "FasTrack order",
      callbackUrl: callback,
      givenId: s.id,
      metadata: { session: s.id },
    });
    await db.from("payment_sessions").update({ status: "initiated", provider_payment_id: payment.id, updated_at: new Date().toISOString() }).eq("id", s.id);
    if (payment.status === "failed") throw new UserError(payment.source?.message || "Your bank declined the payment. Nothing was charged.");
    return { redirectUrl: payment.source?.transaction_url || `${callback}&id=${payment.id}` };
  } catch (e) {
    return failure(e) as never;
  }
}

/** The browser reports the payment id Moyasar gave it, so the server can find the payment even if the shopper never comes back. */
export async function noteProviderPayment(sessionId: string, paymentId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !/^[0-9a-f-]{36}$/i.test(paymentId)) return { ok: false };
    const db = createServiceClient();
    await db
      .from("payment_sessions")
      .update({ status: "initiated", provider_payment_id: paymentId, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("status", "created");
    return { ok: true };
  } catch (e) {
    return failure(e) as never;
  }
}

export async function listSavedCards(): Promise<SavedCard[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("saved_cards" as never)
      .select("id, brand, last4, exp_month, exp_year, holder_name, is_default")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    return ((data ?? []) as { id: string; brand: string; last4: string; exp_month: number | null; exp_year: number | null; holder_name: string | null; is_default: boolean }[]).map((c) => ({
      id: c.id,
      brand: c.brand,
      last4: c.last4,
      expMonth: c.exp_month,
      expYear: c.exp_year,
      holderName: c.holder_name,
      isDefault: c.is_default,
    }));
  } catch (e) {
    return failure(e) as never;
  }
}

export async function deleteSavedCard(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("saved_cards" as never).delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/account/payments");
    return { ok: true };
  } catch (e) {
    return failure(e) as never;
  }
}

export async function setDefaultCard(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserError("You must be logged in.");
    await supabase.from("saved_cards" as never).update({ is_default: false } as never).eq("user_id", user.id);
    const { error } = await supabase.from("saved_cards" as never).update({ is_default: true } as never).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidatePath("/account/payments");
    return { ok: true };
  } catch (e) {
    return failure(e) as never;
  }
}
