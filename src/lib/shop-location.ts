import { createClient } from "@/lib/supabase/server";
import { loadAreas } from "@/lib/delivery-zones";
import { areaAt } from "@/lib/delivery-areas";

export interface ShopLocation {
  lat: number | null;
  lng: number | null;
  address: string | null;
  areaName: string | null;
  zoning: "zones" | "legacy";
}

/** A warehouse's GPS pin and (when common delivery zones are in use) the zone it falls in. A fallback pin is used before the warehouse exists. */
export async function getShopLocation(warehouseId: string | null, fallback?: { lat: number | null; lng: number | null; address: string | null }): Promise<ShopLocation> {
  const areas = await loadAreas();
  let lat = fallback?.lat ?? null;
  let lng = fallback?.lng ?? null;
  let address = fallback?.address ?? null;
  if (warehouseId) {
    const supabase = await createClient();
    const { data } = await supabase.from("warehouses").select("lat, lng, address_line").eq("id", warehouseId).maybeSingle();
    if (data) {
      lat = data.lat;
      lng = data.lng;
      address = data.address_line ?? address;
    }
  }
  return { lat, lng, address, areaName: areaAt(areas, lat, lng)?.name ?? null, zoning: areas.length > 0 ? "zones" : "legacy" };
}
