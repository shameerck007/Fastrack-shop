"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  state?: string;
  /** Rider pickup radius in km (1-200). */
  riderPickupRadiusKm?: number;
}) {
  const radius = input.riderPickupRadiusKm;
  if (radius != null && !(radius >= 1 && radius <= 200)) throw new Error("The rider pickup distance must be between 1 and 200 km.");
  const supabase = await createClient();

  if (!input.tradingName.trim()) throw new Error("Trading name is required.");
  const { data: tenantId } = await supabase.rpc("current_tenant_id" as never);
  if (!tenantId) throw new Error("Could not work out which market these settings belong to.");

  // Ensured by RLS ("admins manage company settings") too — this just
  // surfaces a clear error instead of a silent no-op for a non-admin.
  const row = {
      trading_name: input.tradingName.trim(),
      cr_number: input.crNumber?.trim() || null,
      vat_number: input.vatNumber?.trim() || null,
      address_line: input.addressLine?.trim() || null,
      city: input.city?.trim() || null,
      district: input.district?.trim() || null,
      postal_code: input.postalCode?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      state: input.state?.trim() || null,
      ...(radius != null ? { rider_pickup_radius_km: radius } : {}),
      updated_at: new Date().toISOString(),
    };
  let { error } = await supabase.from("company_settings").update(row).eq("tenant_id", tenantId);
  // The rider-distance column arrives with migration 0059; until then save everything else.
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    const { rider_pickup_radius_km: _r, ...rest } = row as typeof row & { rider_pickup_radius_km?: number };
    ({ error } = await supabase.from("company_settings").update(rest).eq("tenant_id", tenantId));
  }
  if (error) throw error;

  revalidatePath("/admin/settings");
}
