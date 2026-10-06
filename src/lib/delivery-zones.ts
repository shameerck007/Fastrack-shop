import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { distanceKm, type Coords, type ZoneVerdict } from "@/lib/delivery-geo";
import { DEFAULT_STANDARD_DAYS, methodsFor, type DeliveryMethods, type DeliveryZone } from "@/lib/delivery-methods";

// A delivery boundary is a circle around a warehouse (each merchant store
// has its own warehouse; FasTrack's own dark store is the default one).
// radiusKm = null means no boundary has been set, i.e. unrestricted.

export interface WarehouseZone {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** Express radius (the former "delivery radius"). */
  radiusKm: number | null;
  standardEnabled: boolean;
  standardRadiusKm: number | null;
  standardDays: number;
}

export function verdictMessage(verdict: ZoneVerdict, itemName?: string): string | null {
  if (verdict.ok) return null;
  const subject = itemName ? `${itemName} isn't` : "This isn't";
  if (verdict.reason === "no_location") {
    return `${subject} deliverable until you set your delivery location — add an address with a map pin.`;
  }
  return `${subject} deliverable to your location (${verdict.distanceKm.toFixed(1)} km away, seller delivers within ${verdict.radiusKm} km).`;
}

async function loadZonesImpl(): Promise<Map<string, WarehouseZone>> {
  const supabase = await createClient();
  type Row = {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    delivery_radius_km: number | null;
    standard_delivery_enabled?: boolean;
    standard_radius_km?: number | null;
    standard_delivery_days?: number;
  };
  let { data, error } = await supabase
    .from("warehouses")
    .select("id, name, lat, lng, delivery_radius_km, standard_delivery_enabled, standard_radius_km, standard_delivery_days, is_active")
    .eq("is_active", true);
  // Standard-delivery columns arrive with migration 0043 — until it's applied, fall back to the old shape.
  if (error?.code === "42703") {
    ({ data, error } = (await supabase
      .from("warehouses")
      .select("id, name, lat, lng, delivery_radius_km, is_active")
      .eq("is_active", true)) as unknown as { data: typeof data; error: typeof error });
  }
  if (error) throw error;
  return new Map(
    ((data ?? []) as unknown as Row[]).map((w) => [
      w.id,
      {
        id: w.id,
        name: w.name,
        lat: w.lat,
        lng: w.lng,
        radiusKm: w.delivery_radius_km == null ? null : Number(w.delivery_radius_km),
        standardEnabled: w.standard_delivery_enabled ?? true,
        standardRadiusKm: w.standard_radius_km == null ? null : Number(w.standard_radius_km),
        standardDays: w.standard_delivery_days ?? DEFAULT_STANDARD_DAYS,
      },
    ])
  );
}

/** One query per request, however many addresses or products are checked. */
export const loadZones = cache(loadZonesImpl);

export function toDeliveryZone(zone: WarehouseZone | undefined): DeliveryZone | undefined {
  if (!zone) return undefined;
  return {
    lat: zone.lat,
    lng: zone.lng,
    expressRadiusKm: zone.radiusKm,
    standardEnabled: zone.standardEnabled,
    standardRadiusKm: zone.standardRadiusKm,
    standardDays: zone.standardDays,
  };
}

/** Which FasTrack-owned warehouse (products.store_id is null) should fulfil
 * an order at this location — nearest-covering-location routing, the same
 * shape Amazon/Noon use for their own dark-store network: among FasTrack's
 * own active locations, prefer the nearest one whose delivery boundary
 * actually covers these coordinates. If none cover, still return the
 * nearest one (with real lat/lng) so the caller's checkZone() reports a
 * specific "X km away, we deliver within Y km" for that closest location
 * instead of a generic "unavailable". Falls back to the legacy "oldest
 * unowned warehouse" pick when there's no location yet, or no warehouse has
 * coordinates at all. */
/** The stores' warehouse ids and every active warehouse: the same for every address, so asked once per request. */
const loadFastrackCandidates = cache(async () => {
  const supabase = await createClient();
  const [{ data: stores }, { data: warehouses }] = await Promise.all([
    supabase.from("stores").select("warehouse_id"),
    supabase.from("warehouses").select("id, lat, lng, delivery_radius_km").eq("is_active", true),
  ]);
  return { stores: stores ?? [], warehouses: warehouses ?? [] };
});

const loadStoreWarehouses = cache(async (key: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_store_warehouses", { target_store_ids: key.split(",") });
  return (data ?? []) as { store_id: string; warehouse_id: string | null }[];
});

async function resolveFastrackWarehouse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coords: Coords | null
): Promise<string | null> {
  const { stores, warehouses } = await loadFastrackCandidates();

  const merchantWarehouseIds = new Set((stores ?? []).map((s) => s.warehouse_id).filter(Boolean));
  const own = (warehouses ?? []).filter((w) => !merchantWarehouseIds.has(w.id));
  if (own.length === 0) return null;
  if (own.length === 1) return own[0].id;

  const legacyDefault = async () => {
    const { data } = await supabase.rpc("default_warehouse_id");
    return (data as string | null) ?? own[0].id;
  };

  if (!coords || coords.lat == null || coords.lng == null) return legacyDefault();

  const withDistance = own
    .filter((w) => w.lat != null && w.lng != null)
    .map((w) => {
      const distance = distanceKm(coords.lat as number, coords.lng as number, w.lat as number, w.lng as number);
      const radius = w.delivery_radius_km == null ? null : Number(w.delivery_radius_km);
      return { id: w.id, distance, covers: radius == null || distance <= radius };
    })
    .sort((a, b) => a.distance - b.distance);

  const nearestCovering = withDistance.find((w) => w.covers);
  if (nearestCovering) return nearestCovering.id;
  if (withDistance.length > 0) return withDistance[0].id;

  return legacyDefault();
}

/** productId -> the warehouse that fulfils it (merchant's own, else whichever
 * FasTrack-owned location is resolved for these coordinates). */
export async function resolveProductWarehouses(
  products: { id: string; store_id: string | null }[],
  coords: Coords | null = null
): Promise<Map<string, string | null>> {
  const supabase = await createClient();
  const storeIds = [...new Set(products.map((p) => p.store_id).filter((id): id is string => !!id))];

  const storeWarehouse = new Map<string, string | null>();
  if (storeIds.length) {
    for (const row of await loadStoreWarehouses([...storeIds].sort().join(","))) {
      storeWarehouse.set(row.store_id, row.warehouse_id);
    }
  }

  let ownId: string | null = null;
  if (products.some((p) => !p.store_id)) {
    ownId = await resolveFastrackWarehouse(supabase, coords);
  }

  return new Map(products.map((p) => [p.id, p.store_id ? (storeWarehouse.get(p.store_id) ?? null) : ownId]));
}

export interface Deliverability {
  verdict: ZoneVerdict;
  message: string | null;
  methods: DeliveryMethods;
}

/** Deliverability of each product to the given location (productId -> result).
 * A product is deliverable when Express OR Standard applies; the distance radius
 * only decides Express. */
export async function checkProductsDeliverable(
  products: { id: string; store_id: string | null; name?: string }[],
  coords: Coords | null
): Promise<Map<string, Deliverability>> {
  if (products.length === 0) return new Map();
  const [zones, warehouseByProduct] = await Promise.all([loadZones(), resolveProductWarehouses(products, coords)]);
  return new Map(
    products.map((p) => {
      const wid = warehouseByProduct.get(p.id);
      const zone = wid ? zones.get(wid) : undefined;
      const methods = methodsFor(toDeliveryZone(zone), coords);
      let verdict: ZoneVerdict;
      if (methods.state === "no_location") verdict = { ok: false, reason: "no_location" };
      else if (methods.express || methods.standard) verdict = { ok: true };
      else {
        verdict = {
          ok: false,
          reason: "outside",
          distanceKm: methods.distanceKm ?? 0,
          radiusKm: (zone?.standardEnabled ? zone.standardRadiusKm : zone?.radiusKm) ?? zone?.radiusKm ?? 0,
        };
      }
      return [p.id, { verdict, message: verdictMessage(verdict, p.name), methods }];
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
