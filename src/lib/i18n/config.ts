export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
// Cookie names can't contain ":" (unlike this app's localStorage keys, e.g.
// "fastrack:delivery-location") — RFC 6265 cookie-name is a token that
// excludes it, and setting it throws rather than silently sanitizing.
export const LOCALE_COOKIE = "fastrack-locale";

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
