import { createClient } from "@/lib/supabase/server";

// A delivery boundary is a circle around a warehouse (each merchant store
// has its own warehouse; FasTrack's own dark store is the default one).
// radiusKm = null means no boundary has been set, i.e. unrestricted.

export interface WarehouseZone {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
}

export interface Coords {
  lat: number | null;
  lng: number | null;
}

export type ZoneVerdict =
  | { ok: true }
  | { ok: false; reason: "no_location" }
  | { ok: false; reason: "outside"; distanceKm: number; radiusKm: number };

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function checkZone(zone: WarehouseZone | undefined, coords: Coords | null): ZoneVerdict {
  if (!zone || zone.radiusKm == null || zone.lat == null || zone.lng == null) return { ok: true };
  if (!coords || coords.lat == null || coords.lng == null) return { ok: false, reason: "no_location" };
  const d = distanceKm(zone.lat, zone.lng, coords.lat, coords.lng);
  if (d <= zone.radiusKm) return { ok: true };
  return { ok: false, reason: "outside", distanceKm: d, radiusKm: zone.radiusKm };
}

export function verdictMessage(verdict: ZoneVerdict, itemName?: string): string | null {
  if (verdict.ok) return null;
  const subject = itemName ? `${itemName} isn't` : "This isn't";
  if (verdict.reason === "no_location") {
    return `${subject} deliverable until you set your delivery location — add an address with a map pin.`;
  }
  return `${subject} deliverable to your location (${verdict.distanceKm.toFixed(1)} km away, seller delivers within ${verdict.radiusKm} km).`;
}

export async function loadZones(): Promise<Map<string, WarehouseZone>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .select("id, name, lat, lng, delivery_radius_km, is_active")
    .eq("is_active", true);
  if (error) throw error;
  return new Map(
    (data ?? []).map((w) => [
      w.id,
      {
        id: w.id,
        name: w.name,
        lat: w.lat,
        lng: w.lng,
        radiusKm: w.delivery_radius_km == null ? null : Number(w.delivery_radius_km),
      },
    ])
  );
}

/** productId -> the warehouse that fulfils it (merchant's own, else the default one). */
export async function resolveProductWarehouses(
  products: { id: string; store_id: string | null }[]
): Promise<Map<string, string | null>> {
  const supabase = await createClient();
  const storeIds = [...new Set(products.map((p) => p.store_id).filter((id): id is string => !!id))];

  const storeWarehouse = new Map<string, string | null>();
  if (storeIds.length) {
    const { data } = await supabase.rpc("get_store_warehouses", { target_store_ids: storeIds });
    for (const row of (data ?? []) as { store_id: string; warehouse_id: string | null }[]) {
      storeWarehouse.set(row.store_id, row.warehouse_id);
    }
  }

  let defaultId: string | null = null;
  if (products.some((p) => !p.store_id)) {
    const { data } = await supabase.rpc("default_warehouse_id");
    defaultId = (data as string | null) ?? null;
  }

  return new Map(
    products.map((p) => [p.id, p.store_id ? (storeWarehouse.get(p.store_id) ?? null) : defaultId])
  );
}

export interface Deliverability {
  verdict: ZoneVerdict;
  message: string | null;
}

/** Deliverability of each product to the given location (productId -> result). */
export async function checkProductsDeliverable(
  products: { id: string; store_id: string | null; name?: string }[],
  coords: Coords | null
): Promise<Map<string, Deliverability>> {
  if (products.length === 0) return new Map();
  const [zones, warehouseByProduct] = await Promise.all([loadZones(), resolveProductWarehouses(products)]);
  return new Map(
    products.map((p) => {
      const wid = warehouseByProduct.get(p.id);
      const verdict = checkZone(wid ? zones.get(wid) : undefined, coords);
      return [p.id, { verdict, message: verdictMessage(verdict, p.name) }];
    })
  );
}

/** The location used for browsing-time checks: the default address, else the newest one with a pin. */
export async function getCustomerLocation(): Promise<
  { label: string; lat: number | null; lng: number | null } | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("addresses")
    .select("label, lat, lng, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { label: data.label, lat: data.lat, lng: data.lng } : null;
}
