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
  // RLS only lets admins update warehouses; a non-admin update matches no
  // rows, which is surfaced as an error below rather than silently ignored.
  const { data, error } = await supabase
    .from("warehouses")
    .update(
      zone
        ? { lat: zone.lat, lng: zone.lng, delivery_radius_km: zone.radiusKm }
        : { delivery_radius_km: null }
    )
    .eq("id", warehouseId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Could not update this delivery zone.");

  revalidatePath("/admin/zones");
}
