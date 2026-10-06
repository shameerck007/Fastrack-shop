// Tax rules per market. Prices in the catalog are tax-INCLUSIVE (what's shown is what the
// customer pays); tax is extracted from each line for the invoice, never added on top.

export interface TaxProfile {
  label: string; // "VAT" | "GST"
  defaultRate: number; // percent
  /** Rates a seller can choose for a product. */
  rates: number[];
}

const PROFILES: Record<string, TaxProfile> = {
  SA: { label: "VAT", defaultRate: 15, rates: [15, 0] },
  // India GST slabs. Most staples are 0 or 5 %; processed food 12 / 18 %; some drinks 28 %.
  IN: { label: "GST", defaultRate: 5, rates: [0, 5, 12, 18, 28] },
};

export function taxProfileFor(countryCode: string | null | undefined): TaxProfile {
  return PROFILES[(countryCode ?? "SA").toUpperCase()] ?? PROFILES.SA;
}

/** GST on the delivery charge (India: 18% service rate, included in the fee). Saudi delivery fees are unchanged. */
export function deliveryTaxRate(countryCode: string | null | undefined): number {
  return (countryCode ?? "SA").toUpperCase() === "IN" ? 18 : 0;
}

/** The tax portion inside a tax-inclusive amount. */
export function extractTax(amountInclusive: number, ratePercent: number): number {
  if (!(ratePercent > 0)) return 0;
  return Math.round(((amountInclusive * ratePercent) / (100 + ratePercent)) * 100) / 100;
}

/** A product's rate: its own, else the market's default. */
export function productTaxRate(product: { tax_rate?: number | null }, countryCode: string | null | undefined): number {
  const own = product.tax_rate;
  return typeof own === "number" && Number.isFinite(own) ? own : taxProfileFor(countryCode).defaultRate;
}

export interface TaxLine {
  rate: number;
  taxable: number; // amount excluding tax
  tax: number;
  gross: number; // amount including tax
}

/** Group order lines by tax rate for the invoice breakdown. */
export function groupTaxByRate(lines: { rate: number; gross: number; tax: number }[]): TaxLine[] {
  const byRate = new Map<number, TaxLine>();
  for (const l of lines) {
    const cur = byRate.get(l.rate) ?? { rate: l.rate, taxable: 0, tax: 0, gross: 0 };
    cur.gross += l.gross;
    cur.tax += l.tax;
    cur.taxable += l.gross - l.tax;
    byRate.set(l.rate, cur);
  }
  return [...byRate.values()]
    .map((l) => ({ ...l, gross: round2(l.gross), tax: round2(l.tax), taxable: round2(l.taxable) }))
    .sort((a, b) => b.rate - a.rate);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
