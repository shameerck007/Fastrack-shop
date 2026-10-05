"use client";

import { createContext, useContext } from "react";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries";

const DefaultCountryCtx = createContext<string>(DEFAULT_COUNTRY_CODE);

/** The visitor's country, detected once on the server (Cloudflare's own
 * `cf-ipcountry` header, no permission prompt) so every phone field in the
 * app can start on the right country code without being handed a prop. */
export default function DefaultCountryProvider({ countryCode, children }: { countryCode: string; children: React.ReactNode }) {
  return <DefaultCountryCtx.Provider value={countryCode}>{children}</DefaultCountryCtx.Provider>;
}

export function useDefaultCountry(): string {
  return useContext(DefaultCountryCtx);
}
