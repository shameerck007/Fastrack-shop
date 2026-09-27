import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

/** Server-side locale for the very first render: an explicit cookie choice
 * wins, otherwise we guess from the browser's Accept-Language header — a
 * phone/browser set to Arabic (common in Saudi Arabia) opens the site in
 * Arabic without needing IP geolocation, and a manual toggle always
 * overrides it via the cookie from then on. */
export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (fromCookie && (LOCALES as readonly string[]).includes(fromCookie)) return fromCookie as Locale;

  const acceptLanguage = (await headers()).get("accept-language") ?? "";
  const primary = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  if (primary.startsWith("ar")) return "ar";
  return DEFAULT_LOCALE;
}
