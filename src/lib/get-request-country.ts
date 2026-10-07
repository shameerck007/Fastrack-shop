import { cookies, headers } from "next/headers";
import { TENANT_COOKIE } from "@/lib/tenant";
import { getCurrentTenant } from "@/lib/tenant-server";
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

/** The country code a typed mobile number starts with when it has no "+": the market the visitor is shopping in
 * (so 9000000001 in the India shop means +91 even if they are physically in Saudi Arabia), else their own country. */
export async function getDefaultPhoneCountry(): Promise<string> {
  const chosen = (await cookies()).get(TENANT_COOKIE)?.value;
  if (chosen) {
    const market = (await getCurrentTenant().catch(() => null))?.country_code;
    if (market && COUNTRIES.some((c) => c.code === market)) return market;
  }
  return getRequestCountryCode();
}
