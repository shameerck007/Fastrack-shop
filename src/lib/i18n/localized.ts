import type { Locale } from "./config";

/** Prefer a row's own name_ar (products, categories) when browsing in
 * Arabic and it's set, otherwise fall back to the English name rather than
 * showing blank for rows a merchant hasn't translated yet. */
export function localizedName(item: { name: string; name_ar?: string | null }, locale: Locale): string {
  if (locale === "ar" && item.name_ar) return item.name_ar;
  return item.name;
}

/** Generic version of localizedName for any English/Arabic field pair
 * (brand/brand_ar, description/description_ar, origin/origin_ar,
 * label/label_ar, ...) — same fallback rule: prefer the Arabic value in
 * Arabic mode when it's set, otherwise fall back to the English value. */
export function localizedField(value: string | null | undefined, valueAr: string | null | undefined, locale: Locale): string | null {
  if (locale === "ar" && valueAr) return valueAr;
  return value ?? null;
}
