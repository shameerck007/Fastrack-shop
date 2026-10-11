import { createClient } from "@/lib/supabase/server";
import type { CartItemWithVariant } from "@/types/database";

export type OfferKind = "percent" | "fixed" | "free_delivery";
export type OfferFunder = "fastrack" | "supplier";

/** One offer that applies to a cart. A cart can carry two when the first allows combining. */
export interface OfferPart {
  offerId: string;
  name: string;
  nameAr: string | null;
  /** The coupon code the shopper typed; empty for an automatic offer. */
  code: string | null;
  kind: OfferKind;
  /** Money taken off the items by this offer. */
  discount: number;
  /** Delivery is free with this offer. */
  freeDelivery: boolean;
  /** Who pays for it: FasTrack, or the supplier whose items it covers (taken off that supplier's settlement). */
  fundedBy: OfferFunder;
  storeId: string | null;
  /** Per cart line: does the discount apply to it. */
  eligible: boolean[];
}

export interface OfferQuote {
  ok: boolean;
  /** Why an offer could not be used: invalid, expired, min_order, used_up, used_by_you, first_order_only, no_eligible, none. */
  reason?: string;
  minOrder?: number;
  parts: OfferPart[];
  /** Total money off the items, all offers together. */
  discount: number;
  /** Any offer makes the delivery free. */
  freeDelivery: boolean;
  /** The coupon code among the offers, if one was used. */
  code: string | null;
  /** The discount on each cart line, and the part of it a supplier pays for. */
  lineDiscount: number[];
  lineSupplierFunded: number[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface RawPart {
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
  funded_by?: OfferFunder;
  store_id?: string | null;
  eligible?: boolean[];
}
interface RawQuote extends RawPart {
  parts?: RawPart[];
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
    out[i] = Math.max(0, Math.min(lineTotals[i], share));
    given = round2(given + out[i]);
  });
  return out;
}

const empty = (lines: number, reason: string, extra: Partial<OfferQuote> = {}): OfferQuote => ({
  ok: false,
  reason,
  parts: [],
  discount: 0,
  freeDelivery: false,
  code: null,
  lineDiscount: Array(lines).fill(0),
  lineSupplierFunded: Array(lines).fill(0),
  ...extra,
});

/** Asks the database which offers apply to this cart. A code is checked on its own; with no code the best automatic offer wins. */
export async function quoteForCart(code: string | null, items: CartItemWithVariant[]): Promise<OfferQuote> {
  const lineTotals = items.map((i) => round2(i.quantity * i.product_variants.price));
  const lines = items.map((i, n) => ({ category_id: i.product_variants.products.category_id ?? null, store_id: i.product_variants.products.store_id ?? null, total: lineTotals[n] }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("offer_quote" as never, { p_code: code, p_lines: lines } as never);
  // Before the offers migration is in, there are simply no offers.
  if (error) return empty(items.length, code ? "invalid" : "none");
  const q = (data ?? {}) as RawQuote;
  const rawParts = q.parts ?? (q.ok ? [q] : []);
  if (!q.ok || rawParts.length === 0) return empty(items.length, q.reason ?? "none", { minOrder: q.min_order != null ? Number(q.min_order) : undefined });

  // The offers add up line by line: the second one works on what the first left, so a line never goes below zero.
  const remaining = [...lineTotals];
  const lineDiscount = lineTotals.map(() => 0);
  const lineSupplierFunded = lineTotals.map(() => 0);
  const parts: OfferPart[] = rawParts.map((p) => {
    const eligible = Array.isArray(p.eligible) ? p.eligible : lines.map(() => true);
    const share = discountPerLine(remaining, eligible, round2(Number(p.discount ?? 0)));
    share.forEach((v, i) => {
      lineDiscount[i] = round2(lineDiscount[i] + v);
      remaining[i] = round2(remaining[i] - v);
      if (p.funded_by === "supplier") lineSupplierFunded[i] = round2(lineSupplierFunded[i] + v);
    });
    return {
      offerId: p.offer_id as string,
      name: p.name ?? "",
      nameAr: p.name_ar ?? null,
      code: p.code ?? null,
      kind: p.kind as OfferKind,
      discount: round2(share.reduce((n, v) => n + v, 0)),
      freeDelivery: !!p.free_delivery,
      fundedBy: p.funded_by === "supplier" ? "supplier" : "fastrack",
      storeId: p.store_id ?? null,
      eligible,
    };
  });
  return {
    ok: true,
    parts,
    discount: round2(lineDiscount.reduce((n, v) => n + v, 0)),
    freeDelivery: parts.some((p) => p.freeDelivery),
    code: parts.find((p) => p.code)?.code ?? null,
    lineDiscount,
    lineSupplierFunded,
  };
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
