import { createClient } from "@/lib/supabase/server";

export const COMPANY_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export interface CompanySettings {
  trading_name: string;
  cr_number: string | null;
  vat_number: string | null;
  address_line: string | null;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  /** State (for GST CGST/SGST vs IGST); column added by migration 0047. */
  state?: string | null;
}

const FALLBACK: CompanySettings = {
  trading_name: "FasTrack Shop",
  cr_number: null,
  vat_number: null,
  address_line: null,
  city: null,
  district: null,
  postal_code: null,
  phone: null,
  email: null,
};

export async function getCompanySettings(): Promise<CompanySettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_settings")
    .select("*")
    // One row per tenant; the database's tenant rules return only the current market's row.
    .limit(1)
    .maybeSingle();
  return data ?? FALLBACK;
}
