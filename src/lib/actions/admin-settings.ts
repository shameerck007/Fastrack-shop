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
  /** Delivery time estimate (migration 0060). */
  prepMinutes?: number;
  riderSpeedKmh?: number;
  etaBufferMinutes?: number;
  /** Quick delivery auto-dispatch (migration 0063). */
  expressAutoDispatch?: boolean;
  expressRiderRadiusKm?: number;
  expressOfferSeconds?: number;
  /** Rider pay per delivery (migration 0064). null clears it (riders earn the delivery fee). */
  riderPayBase?: number | null;
  riderPayPerKm?: number;
}) {
  const { riderPayBase, riderPayPerKm } = input;
  if (riderPayBase != null && !(riderPayBase >= 0 && riderPayBase <= 10000)) throw new Error("Rider pay per delivery must be between 0 and 10,000.");
  if (riderPayPerKm != null && !(riderPayPerKm >= 0 && riderPayPerKm <= 1000)) throw new Error("Rider pay per km must be between 0 and 1,000.");
  const { prepMinutes, riderSpeedKmh, etaBufferMinutes, expressAutoDispatch, expressRiderRadiusKm, expressOfferSeconds } = input;
  if (expressRiderRadiusKm != null && !(expressRiderRadiusKm > 0 && expressRiderRadiusKm <= 200)) throw new Error("The Express rider distance must be between 0.5 and 200 km.");
  if (expressOfferSeconds != null && !(expressOfferSeconds >= 10 && expressOfferSeconds <= 300)) throw new Error("The offer time must be between 10 and 300 seconds.");
  if (prepMinutes != null && !(prepMinutes >= 0 && prepMinutes <= 120)) throw new Error("Preparation time must be between 0 and 120 minutes.");
  if (riderSpeedKmh != null && !(riderSpeedKmh >= 5 && riderSpeedKmh <= 80)) throw new Error("Rider speed must be between 5 and 80 km/h.");
  if (etaBufferMinutes != null && !(etaBufferMinutes >= 0 && etaBufferMinutes <= 60)) throw new Error("The extra minutes must be between 0 and 60.");
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
      ...(prepMinutes != null ? { prep_minutes: Math.round(prepMinutes) } : {}),
      ...(riderSpeedKmh != null ? { rider_speed_kmh: riderSpeedKmh } : {}),
      ...(etaBufferMinutes != null ? { eta_buffer_minutes: Math.round(etaBufferMinutes) } : {}),
      ...(expressAutoDispatch != null ? { express_auto_dispatch: expressAutoDispatch } : {}),
      ...(riderPayBase !== undefined ? { rider_pay_base: riderPayBase } : {}),
      ...(riderPayPerKm != null ? { rider_pay_per_km: riderPayPerKm } : {}),
      ...(expressRiderRadiusKm != null ? { express_rider_radius_km: expressRiderRadiusKm } : {}),
      ...(expressOfferSeconds != null ? { express_offer_seconds: Math.round(expressOfferSeconds) } : {}),
      updated_at: new Date().toISOString(),
    };
  let { error } = await supabase.from("company_settings").update(row).eq("tenant_id", tenantId);
  // The rider-distance column arrives with migration 0059; until then save everything else.
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    const { rider_pickup_radius_km: _r, prep_minutes: _p, rider_speed_kmh: _s, eta_buffer_minutes: _b, express_auto_dispatch: _ea, express_rider_radius_km: _er, express_offer_seconds: _eo, rider_pay_base: _pb, rider_pay_per_km: _pk, ...rest } = row as typeof row & {
      rider_pay_base?: number | null;
      rider_pay_per_km?: number;
      express_auto_dispatch?: boolean;
      express_rider_radius_km?: number;
      express_offer_seconds?: number;
      rider_pickup_radius_km?: number;
      prep_minutes?: number;
      rider_speed_kmh?: number;
      eta_buffer_minutes?: number;
    };
    ({ error } = await supabase.from("company_settings").update(rest).eq("tenant_id", tenantId));
  }
  if (error) throw error;

  revalidatePath("/admin/settings");
}
