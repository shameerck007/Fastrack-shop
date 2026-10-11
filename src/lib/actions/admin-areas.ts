"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePolygon, polygonProblem, type LatLng } from "@/lib/geo-polygon";

export interface AreaInput {
  id?: string;
  name: string;
  nameAr?: string;
  shape: { polygon: LatLng[] | null; lat: number; lng: number; radiusKm: number };
  expressEnabled: boolean;
  expressMaxKm: number;
  standardEnabled: boolean;
  standardDays: number;
  logisticsEnabled: boolean;
  priority: number;
}

const MISSING = "Common delivery areas need database migration 0074. Run it in the Supabase SQL editor, then try again.";

/** Creates or updates a common delivery area. */
export async function saveDeliveryArea(input: AreaInput): Promise<{ error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Give the area a name." };
  const polygon = input.shape.polygon ? parsePolygon(input.shape.polygon) : null;
  if (input.shape.polygon && !polygon) return { error: "The drawn area is not valid." };
  const problem = polygonProblem(polygon);
  if (problem) return { error: problem };
  if (!polygon && (!Number.isFinite(input.shape.lat) || !Number.isFinite(input.shape.lng) || !(input.shape.radiusKm > 0))) {
    return { error: "Mark the area on the map: drop a pin and set a radius, or draw the area." };
  }
  if (!(input.expressMaxKm > 0 && input.expressMaxKm <= 100)) return { error: "Express distance must be between 0.1 and 100 km." };
  if (!Number.isInteger(input.standardDays) || input.standardDays < 0 || input.standardDays > 30) return { error: "Standard days must be a whole number from 0 to 30." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  const row = {
    name,
    name_ar: input.nameAr?.trim() || null,
    polygon,
    lat: polygon ? null : input.shape.lat,
    lng: polygon ? null : input.shape.lng,
    radius_km: polygon ? null : input.shape.radiusKm,
    express_enabled: input.expressEnabled,
    express_max_km: input.expressMaxKm,
    standard_enabled: input.standardEnabled,
    standard_days: input.standardDays,
    logistics_enabled: input.logisticsEnabled,
    priority: Math.max(-100, Math.min(100, Math.round(input.priority || 0))),
    updated_at: new Date().toISOString(),
  };
  // The tables are not in the generated types until the migration is in.
  const loose = supabase as unknown as { from: (t: string) => { insert: (r: object) => Promise<{ error: { code?: string; message: string } | null }>; update: (r: object) => { eq: (c: string, v: string) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { code?: string; message: string } | null }> } } } };
  if (input.id) {
    const { data, error } = await loose.from("delivery_areas").update(row).eq("id", input.id).select("id");
    if (error) return { error: error.code === "42P01" ? MISSING : error.message };
    if (!data || data.length === 0) return { error: "Could not update this area. It may have been removed. Refresh and try again." };
  } else {
    const { error } = await loose.from("delivery_areas").insert(row);
    if (error) return { error: error.code === "42P01" ? MISSING : error.message };
  }
  revalidatePath("/admin/zones");
  return {};
}

export async function deleteDeliveryArea(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const loose = supabase as unknown as { from: (t: string) => { delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } } };
  const { error } = await loose.from("delivery_areas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/zones");
  return {};
}

/** Per-shop exceptions to the area rules: Express off, or a shorter Express distance. */
export async function setWarehouseExpressOverride(warehouseId: string, mode: "auto" | "off", maxKm: number | null): Promise<{ error?: string }> {
  if (maxKm != null && !(maxKm > 0 && maxKm <= 100)) return { error: "Express distance must be between 0.1 and 100 km, or empty to follow the area." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .update({ express_mode: mode, express_max_km: maxKm } as never)
    .eq("id", warehouseId)
    .select("id");
  if (error) return { error: error.code === "42703" || error.code === "PGRST204" ? MISSING : error.message };
  if (!data || data.length === 0) return { error: "Could not update this shop. Refresh and try again." };
  revalidatePath("/admin/zones");
  return {};
}

/** Sets (or moves) a shop's or warehouse's GPS pin. The area it belongs to is worked out from this. */
export async function setWarehouseLocation(warehouseId: string, lat: number, lng: number): Promise<{ error?: string }> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: "Pick a valid point on the map." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("warehouses").update({ lat, lng }).eq("id", warehouseId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Could not update this shop. Refresh and try again." };
  // Keep the supplier's own record in step (column arrives with migration 0073).
  await supabase.from("stores").update({ lat, lng } as never).eq("warehouse_id", warehouseId);
  revalidatePath("/admin/zones");
  return {};
}
