import { dictionary } from "./dictionary";
import type { Locale } from "./config";

type Vars = Record<string, string | number>;

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/** Dot-path lookup with {var} interpolation, falling back to English then
 * the raw key so a missing translation never renders blank. */
export function translate(locale: Locale, key: string, vars?: Vars): string {
  const value = getPath(dictionary[locale], key) ?? getPath(dictionary.en, key) ?? key;
  let text = typeof value === "string" ? value : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
