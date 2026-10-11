import { createClient } from "@/lib/supabase/server";
import type { CartItemWithVariant } from "@/types/database";

export type OfferKind = "percent" | "fixed" | "free_delivery";

export interface OfferQuote {
  ok: boolean;
  /** Why an offer could not be used: invalid, expired, min_order, used_up, used_by_you, first_order_only, no_eligible, none. */
  reason?: string;
  offerId?: string;
  name?: string;
  nameAr?: string | null;
  code?: string | null;
  kind?: OfferKind;
  /** Money taken off the items. */
  discount: number;
  /** Delivery is free with this offer. */
  freeDelivery: boolean;
  minOrder?: number;
  /** Per cart line: does the discount apply to it (an offer can be limited to a category). */
  eligible: boolean[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface RawQuote {
  ok?: boolean;
  reason?: string;
  offer_id?: string;
  name?: string;
  name_ar?: string | null;
  code?: string | null;
  kind?: OfferKind;
  discount?: number | string;
  free_delivery?: boolean;
  min_order?: number | string;
  eligible?: boolean[];
}

/** Asks the database which offer applies to this cart. A code is checked on its own; with no code the best automatic offer wins. */
export async function quoteForCart(code: string | null, items: CartItemWithVariant[]): Promise<OfferQuote> {
  const lines = items.map((i) => ({ category_id: i.product_variants.products.category_id ?? null, total: round2(i.quantity * i.product_variants.price) }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("offer_quote" as never, { p_code: code, p_lines: lines } as never);
  const none: OfferQuote = { ok: false, reason: "none", discount: 0, freeDelivery: false, eligible: [] };
  // Before migration 0081 is in, there are simply no offers.
  if (error) return code ? { ...none, reason: "invalid" } : none;
  const q = (data ?? {}) as RawQuote;
  return {
    ok: !!q.ok,
    reason: q.reason,
    offerId: q.offer_id,
    name: q.name,
    nameAr: q.name_ar ?? null,
    code: q.code ?? null,
    kind: q.kind,
    discount: q.ok ? round2(Number(q.discount ?? 0)) : 0,
    freeDelivery: !!q.ok && !!q.free_delivery,
    minOrder: q.min_order != null ? Number(q.min_order) : undefined,
    eligible: Array.isArray(q.eligible) ? q.eligible : lines.map(() => true),
  };
}

/** Shares a discount between the cart lines it applies to, in proportion to their totals, to the cent (the last line takes the remainder). */
export function discountPerLine(lineTotals: number[], eligible: boolean[], discount: number): number[] {
  const out = lineTotals.map(() => 0);
  const idx = lineTotals.map((_, i) => i).filter((i) => eligible[i] !== false && lineTotals[i] > 0);
  const base = idx.reduce((n, i) => n + lineTotals[i], 0);
  if (discount <= 0 || base <= 0) return out;
  let given = 0;
  idx.forEach((i, k) => {
    const share = k === idx.length - 1 ? round2(discount - given) : round2((lineTotals[i] / base) * discount);
    out[i] = Math.min(lineTotals[i], share);
    given = round2(given + out[i]);
  });
  return out;
}

/** Why a code could not be used, in plain words (the shop's checkout shows its own translated text for the same reasons). */
export const OFFER_REASON_EN: Record<string, string> = {
  invalid: "That code isn't valid.",
  expired: "That offer has ended.",
  min_order: "Your cart is below the minimum order for that code.",
  used_up: "That code has been fully used.",
  used_by_you: "You have already used that code.",
  first_order_only: "That code is for first orders only.",
  no_eligible: "Nothing in your cart qualifies for that code.",
};
