import type { Locale } from "./config";

/** Prefer a row's own name_ar (products, categories) when browsing in
 * Arabic and it's set, otherwise fall back to the English name rather than
 * showing blank for rows a merchant hasn't translated yet. */
export function localizedName(item: { name: string; name_ar?: string | null }, locale: Locale): string {
  if (locale === "ar" && item.name_ar) return item.name_ar;
  return item.name;
}
