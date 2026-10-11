import Link from "@/components/Link";
import { createClient } from "@/lib/supabase/server";
import CoverageExplorer, { type CoverageShop, type CoverageZone } from "@/components/admin/CoverageExplorer";
import { areaAt, parseAreas } from "@/lib/delivery-areas";

export const metadata = { title: "Delivery coverage" };

const COLORS = ["#1d4ed8", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#dc2626"];

export default async function CoveragePage() {
  const supabase = await createClient();
  const loose = supabase as unknown as { from: (t: string) => { select: (c: string) => Promise<{ data: unknown; error: unknown }> } };
  const [areasResult, whResult, overridesResult, storesResult, productsResult, ordersResult, addressesResult] = await Promise.all([
    loose.from("delivery_areas").select("*"),
    supabase.from("warehouses").select("id, name, address_line, lat, lng").eq("is_active", true).order("created_at", { ascending: true }),
    loose.from("warehouses").select("id, express_mode, express_max_km"),
    supabase.from("stores").select("id, name, warehouse_id, address_line, status"),
    supabase.from("products").select("store_id").eq("is_active", true),
    supabase.from("orders").select("warehouse_id").limit(5000),
    supabase.from("addresses").select("lat, lng").not("lat", "is", null).limit(5000),
  ]);

  const rawAreas = (areasResult.error ? [] : (areasResult.data as { id: string; is_active?: boolean }[])) ?? [];
  const areas = parseAreas(rawAreas).filter((a) => rawAreas.find((r) => r.id === a.id)?.is_active !== false);

  if (areas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center">
        <span className="text-5xl">🗺️</span>
        <h1 className="text-xl font-extrabold text-neutral-900">No delivery zones yet</h1>
        <p className="max-w-md text-sm text-neutral-500">The coverage map shows your zones, the shops in them and where customers are. Add your first zone to see it.</p>
        <Link href="/admin/zones" className="rounded-full bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800">
          Add a delivery zone
        </Link>
      </div>
    );
  }

  const warehouses = (whResult.data ?? []) as { id: string; name: string; address_line: string | null; lat: number | null; lng: number | null }[];
  const overrides = new Map(
    ((overridesResult.error ? [] : overridesResult.data) as { id: string; express_mode?: "auto" | "off"; express_max_km?: number | string | null }[]).map((o) => [o.id, o])
  );
  const storeOfWarehouse = new Map((storesResult.data ?? []).map((s) => [s.warehouse_id, s]));
  const productsByStore = new Map<string | null, number>();
  for (const p of productsResult.data ?? []) productsByStore.set(p.store_id, (productsByStore.get(p.store_id) ?? 0) + 1);
  const ordersByWarehouse = new Map<string, number>();
  for (const o of ordersResult.data ?? []) if (o.warehouse_id) ordersByWarehouse.set(o.warehouse_id, (ordersByWarehouse.get(o.warehouse_id) ?? 0) + 1);
  const pins = ((addressesResult.data ?? []) as { lat: number; lng: number }[]).filter((a) => a.lat != null && a.lng != null);

  const shops: CoverageShop[] = warehouses.map((w) => {
    const area = areaAt(areas, w.lat, w.lng);
    const o = overrides.get(w.id);
    const mode: "auto" | "off" = o?.express_mode === "off" ? "off" : "auto";
    const own = o?.express_max_km == null ? null : Number(o.express_max_km);
    const st = storeOfWarehouse.get(w.id);
    return {
      id: w.id,
      name: st?.name ?? w.name,
      kind: st ? "supplier" : "fastrack",
      address: st?.address_line ?? w.address_line ?? null,
      lat: w.lat,
      lng: w.lng,
      areaName: area?.name ?? null,
      areaColor: null,
      areaId: area?.id ?? null,
      expressMode: mode,
      expressMaxKm: own,
      expressReachKm: area ? Math.min(area.expressMaxKm, own ?? Infinity) : null,
      expressOn: mode !== "off" && !!area && area.expressEnabled,
      standardOn: area ? area.standardEnabled : true,
      orders: ordersByWarehouse.get(w.id) ?? 0,
      products: st ? (productsByStore.get(st.id) ?? 0) : (productsByStore.get(null) ?? 0),
    };
  });

  const zones: CoverageZone[] = areas.map((a, i) => {
    const inside = shops.filter((s) => s.areaId === a.id);
    return {
      id: a.id,
      name: a.name,
      color: COLORS[i % COLORS.length],
      polygon: a.polygon,
      lat: a.lat,
      lng: a.lng,
      radiusKm: a.radiusKm,
      expressEnabled: a.expressEnabled,
      expressMaxKm: a.expressMaxKm,
      standardEnabled: a.standardEnabled,
      standardDays: a.standardDays,
      priority: a.priority,
      shops: inside.length,
      customers: pins.filter((p) => areaAt(areas, p.lat, p.lng)?.id === a.id).length,
      orders: inside.reduce((n, s) => n + s.orders, 0),
      products: inside.reduce((n, s) => n + s.products, 0),
    };
  });
  const colorOf = new Map(zones.map((z) => [z.id, z.color]));
  for (const s of shops) s.areaColor = s.areaId ? (colorOf.get(s.areaId) ?? null) : null;
  const points = pins.map((p) => ({ lat: p.lat, lng: p.lng, outside: !areaAt(areas, p.lat, p.lng) }));

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-neutral-500">
        <Link href="/admin/zones" className="text-blue-700 hover:underline">
          Delivery zones
        </Link>
        <span aria-hidden>/</span>
        <span>Coverage map</span>
      </div>
      <CoverageExplorer zones={zones} shops={shops} points={points} />
    </div>
  );
}
