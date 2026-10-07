"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePolygon, polygonProblem, type LatLng } from "@/lib/geo-polygon";

export async function updateWarehouseZone(
  warehouseId: string,
  zone: { lat: number; lng: number; radiusKm: number; /** Custom Express area; null/omitted = use the circle. */ polygon?: LatLng[] | null } | null
) {
  const polygon = zone?.polygon ? parsePolygon(zone.polygon) : null;
  if (zone?.polygon && !polygon) throw new Error("The drawn area is not valid.");
  const problem = polygonProblem(polygon);
  if (problem) throw new Error(problem);

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
    ? { lat: zone.lat, lng: zone.lng, delivery_radius_km: zone.radiusKm, delivery_polygon: polygon }
    : { delivery_radius_km: null, delivery_polygon: null };

  // RLS only lets admins update warehouses, so a non-admin update matches no
  // rows — but we've also seen a genuinely transient 0-row result here (a
  // momentary 502 from the Supabase gateway on this exact endpoint), so a
  // single retry before giving up saves the admin a confusing false
  // failure on an otherwise-valid save.
  async function attempt() {
    return supabase.from("warehouses").update(payload).eq("id", warehouseId).select("id");
  }

  let { data, error } = await attempt();
  // The custom-area column arrives with migration 0059; until then only the circle can be saved.
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    if (polygon) throw new Error("Custom areas need the latest database update (migration 0059). Run it, then try again.");
    const { delivery_polygon: _p, ...legacy } = payload;
    ({ data, error } = await supabase.from("warehouses").update(legacy).eq("id", warehouseId).select("id"));
  }
  if (!error && (!data || data.length === 0)) {
    ({ data, error } = await attempt());
  }
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Could not update this delivery zone — this warehouse may have been removed. Refresh the page and try again.");
  }

  revalidatePath("/admin/zones");
}

/** Standard delivery settings for a warehouse: on/off, optional distance limit, estimated days.
 * The warehouse's delivery radius (set in the map editor) now only controls Express. */
export async function updateWarehouseStandardDelivery(
  warehouseId: string,
  settings: { enabled: boolean; radiusKm: number | null; days: number }
): Promise<{ error?: string }> {
  if (settings.radiusKm != null && !(settings.radiusKm > 0 && settings.radiusKm <= 5000)) {
    return { error: "Standard delivery radius must be between 0.1 and 5000 km, or empty for no limit." };
  }
  if (!Number.isInteger(settings.days) || settings.days < 0 || settings.days > 30) {
    return { error: "Estimated delivery days must be a whole number from 0 to 30." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — please sign in again and retry." };

  const { data, error } = await supabase
    .from("warehouses")
    .update({
      standard_delivery_enabled: settings.enabled,
      standard_radius_km: settings.radiusKm,
      standard_delivery_days: settings.days,
    } as never)
    .eq("id", warehouseId)
    .select("id");
  if (error) {
    return {
      error:
        error.code === "42703" || error.code === "PGRST204"
          ? "Standard delivery settings need database migration 0043 first."
          : error.message,
    };
  }
  if (!data || data.length === 0) return { error: "Could not update this warehouse — it may have been removed. Refresh and try again." };

  revalidatePath("/admin/zones");
  return {};
}
