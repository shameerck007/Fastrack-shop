"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_SETTINGS_ID } from "@/lib/company-settings";

export async function updateCompanySettings(input: {
  tradingName: string;
  crNumber?: string;
  vatNumber?: string;
  addressLine?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}) {
  const supabase = await createClient();

  if (!input.tradingName.trim()) throw new Error("Trading name is required.");

  // Ensured by RLS ("admins manage company settings") too — this just
  // surfaces a clear error instead of a silent no-op for a non-admin.
  const { error } = await supabase
    .from("company_settings")
    .update({
      trading_name: input.tradingName.trim(),
      cr_number: input.crNumber?.trim() || null,
      vat_number: input.vatNumber?.trim() || null,
      address_line: input.addressLine?.trim() || null,
      city: input.city?.trim() || null,
      district: input.district?.trim() || null,
      postal_code: input.postalCode?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", COMPANY_SETTINGS_ID);
  if (error) throw error;

  revalidatePath("/admin/settings");
}
