import { headers } from "next/headers";
import { COUNTRIES, DEFAULT_COUNTRY_CODE } from "@/lib/countries";

/** Cloudflare Workers sets `cf-ipcountry` on every request — no client
 * permission prompt or third-party geolocation call needed, unlike browser
 * geolocation. Falls back to Saudi Arabia (the primary market) when the
 * header is missing (local dev) or an unrecognized/ unsupported country. */
export async function getRequestCountryCode(): Promise<string> {
  const country = (await headers()).get("cf-ipcountry")?.toUpperCase();
  if (country && COUNTRIES.some((c) => c.code === country)) return country;
  return DEFAULT_COUNTRY_CODE;
}
