"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateWarehouseZone(
  warehouseId: string,
  zone: { lat: number; lng: number; radiusKm: number } | null
) {
  if (zone) {
    if (!Number.isFinite(zone.lat) || !Number.isFinite(zone.lng) || Math.abs(zone.lat) > 90 || Math.abs(zone.lng) > 180) {
      throw new Error("Pick a valid centre point on the map.");
    }
    if (!(zone.radiusKm > 0) || zone.radiusKm > 200) {
      throw new Error("Radius must be between 0.1 and 200 km.");
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Your session has expired — please sign in again and retry.");

  const payload = zone
    ? { lat: zone.lat, lng: zone.lng, delivery_radius_km: zone.radiusKm }
    : { delivery_radius_km: null };

  // RLS only lets admins update warehouses, so a non-admin update matches no
  // rows — but we've also seen a genuinely transient 0-row result here (a
  // momentary 502 from the Supabase gateway on this exact endpoint), so a
  // single retry before giving up saves the admin a confusing false
  // failure on an otherwise-valid save.
  async function attempt() {
    return supabase.from("warehouses").update(payload).eq("id", warehouseId).select("id");
  }

  let { data, error } = await attempt();
  if (!error && (!data || data.length === 0)) {
    ({ data, error } = await attempt());
  }
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Could not update this delivery zone — this warehouse may have been removed. Refresh the page and try again.");
  }

  revalidatePath("/admin/zones");
}
