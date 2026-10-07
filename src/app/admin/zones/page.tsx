import { createClient } from "@/lib/supabase/server";
import ZonesList, { type ZoneCard } from "@/components/admin/ZonesList";
import ZonesOverviewMap from "@/components/admin/ZonesOverviewMap";
import ZonesCoverageButton from "@/components/admin/ZonesCoverageButton";
import type { OverviewZone } from "@/components/admin/ZonesOverviewMap";
import { parsePolygon, pointInPolygon } from "@/lib/geo-polygon";
import { distanceKm } from "@/lib/delivery-geo";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

const COLORS = ["#1d4ed8", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#dc2626"];

interface WarehouseRow {
  id: string;
  name: string;
  address_line: string | null;
  lat: number | null;
  lng: number | null;
  delivery_radius_km: number | null;
  standard_delivery_enabled?: boolean;
  standard_radius_km?: number | null;
  standard_delivery_days?: number;
  delivery_polygon?: unknown;
}

function Stat({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: string;
  label: string;
  value: string | number;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ background: `${accent}1a`, color: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p className="text-2xl font-semibold leading-tight text-neutral-900">{value}</p>
        {hint && <p className="truncate text-xs text-neutral-400">{hint}</p>}
      </div>
    </div>
  );
}

export default async function AdminZonesPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const supabase = await createClient();
  const [{ data: warehouses }, { data: stores }, { data: products }, { data: orders }, { data: addresses }] =
    await Promise.all([
      supabase
        .from("warehouses")
        .select("id, name, address_line, lat, lng, delivery_radius_km, standard_delivery_enabled, standard_radius_km, standard_delivery_days, delivery_polygon")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase.from("stores").select("id, name, warehouse_id, contact_phone, address_line, status"),
      supabase.from("products").select("store_id").eq("is_active", true),
      supabase.from("orders").select("warehouse_id").limit(5000),
      supabase.from("addresses").select("lat, lng").not("lat", "is", null).limit(5000),
    ]);

  let warehouseRows = warehouses;
  if (!warehouseRows) {
    // The custom-area column arrives with migration 0059: read the shape without it first.
    const { data: noShape } = await supabase
      .from("warehouses")
      .select("id, name, address_line, lat, lng, delivery_radius_km, standard_delivery_enabled, standard_radius_km, standard_delivery_days")
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    warehouseRows = noShape as typeof warehouses;
  }
  if (!warehouseRows) {
    // Standard-delivery columns arrive with migration 0043; until then read the old shape.
    const { data: legacy } = await supabase
      .from("warehouses")
      .select("id, name, address_line, lat, lng, delivery_radius_km")
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    warehouseRows = legacy as typeof warehouses;
  }
  const rows = (warehouseRows ?? []) as WarehouseRow[];
  const storeByWarehouse = new Map((stores ?? []).map((s) => [s.warehouse_id, s]));

  const productsByStore = new Map<string | null, number>();
  for (const p of products ?? []) productsByStore.set(p.store_id, (productsByStore.get(p.store_id) ?? 0) + 1);
  const ordersByWarehouse = new Map<string, number>();
  for (const o of orders ?? []) {
    if (o.warehouse_id) ordersByWarehouse.set(o.warehouse_id, (ordersByWarehouse.get(o.warehouse_id) ?? 0) + 1);
  }
  const pins = ((addresses ?? []) as { lat: number; lng: number }[]).filter((a) => a.lat != null && a.lng != null);

  const cards = rows.map((w, index) => {
    const store = storeByWarehouse.get(w.id);
    const zoned = w.delivery_radius_km != null && w.lat != null && w.lng != null;
    const radius = w.delivery_radius_km == null ? null : Number(w.delivery_radius_km);
    const shape = parsePolygon(w.delivery_polygon);
    const inside = shape
      ? pins.filter((p) => pointInPolygon(p.lat, p.lng, shape)).length
      : zoned && radius != null
        ? pins.filter((p) => distanceKm(w.lat as number, w.lng as number, p.lat, p.lng) <= radius).length
        : null;
    return {
      w,
      store,
      zoned,
      radius,
      shape,
      inside,
      color: COLORS[index % COLORS.length],
      productCount: store ? (productsByStore.get(store.id) ?? 0) : (productsByStore.get(null) ?? 0),
      orderCount: ordersByWarehouse.get(w.id) ?? 0,
      // A merchant's own store name, or the warehouse's own name for a
      // FasTrack-owned location — FasTrack can have several locations now
      // (0030), so a shared generic label here would make every one of
      // them indistinguishable on this page.
      displayName: store?.name ?? w.name,
    };
  });

  cards.sort((a, b) => Number(a.zoned) - Number(b.zoned));

  const listCards: ZoneCard[] = cards.map((c) => ({
    warehouseId: c.w.id,
    warehouseName: c.w.name,
    storeAddress: c.store?.address_line ?? c.w.address_line ?? null,
    contactPhone: c.store?.contact_phone ?? null,
    displayName: c.displayName,
    color: c.color,
    zoned: c.zoned,
    radius: c.radius,
    lat: c.w.lat,
    lng: c.w.lng,
    productCount: c.productCount,
    orderCount: c.orderCount,
    inside: c.inside,
    standardEnabled: c.w.standard_delivery_enabled ?? true,
    standardRadius: c.w.standard_radius_km == null ? null : Number(c.w.standard_radius_km),
    standardDays: c.w.standard_delivery_days ?? 2,
    polygon: c.shape,
  }));

  const overviewZones: OverviewZone[] = cards
    .filter((c) => c.w.lat != null && c.w.lng != null)
    .map((c) => ({
      id: c.w.id,
      name: c.displayName,
      lat: c.w.lat as number,
      lng: c.w.lng as number,
      radiusKm: c.zoned ? (c.radius as number) : null,
      color: c.color,
      polygon: c.shape,
      kind: c.store ? ("supplier" as const) : ("fastrack" as const),
      orders: c.orderCount,
      products: c.productCount,
      customers: c.inside,
      standardEnabled: c.w.standard_delivery_enabled ?? true,
      standardRadiusKm: c.w.standard_radius_km == null ? null : Number(c.w.standard_radius_km),
      standardDays: c.w.standard_delivery_days ?? 2,
      address: c.store?.address_line ?? c.w.address_line ?? null,
    }));
  const areaZones = overviewZones.filter((z) => z.radiusKm != null || (z.polygon && z.polygon.length >= 3));

  const zonedCount = cards.filter((c) => c.zoned).length;
  const uncovered = pins.filter(
    (p) => areaZones.length > 0 && !areaZones.some((z) => (z.polygon ? pointInPolygon(p.lat, p.lng, z.polygon) : distanceKm(z.lat, z.lng, p.lat, p.lng) <= (z.radiusKm as number)))
  ).length;
  const anyUnrestricted = cards.some((c) => !c.zoned);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">
            📍
          </span>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{t("admin.delivery_zones_title")}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">{t("admin.zones_subtitle")}</p>
          </div>
        </div>
        <ZonesCoverageButton
          zones={overviewZones}
          customerPoints={pins.map((p) => ({ lat: p.lat, lng: p.lng }))}
        />
      </div>

      <div className="mb-5 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
        <ZonesOverviewMap zones={overviewZones} customerPoints={pins.map((p) => ({ lat: p.lat, lng: p.lng }))} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="🏪" label={t("admin.stores_warehouses")} value={cards.length} accent="#2563eb" />
        <Stat
          icon="🎯"
          label={t("admin.with_a_boundary")}
          value={t("admin.of_count", { count: zonedCount, total: cards.length })}
          hint={
            zonedCount === cards.length
              ? t("admin.all_configured")
              : t("admin.still_unrestricted", { count: cards.length - zonedCount })
          }
          accent={zonedCount === cards.length ? "#059669" : "#d97706"}
        />
        <Stat
          icon="📌"
          label={t("admin.customer_addresses_pinned")}
          value={pins.length}
          hint={t("admin.saved_with_map_location")}
          accent="#7c3aed"
        />
        <Stat
          icon="⚠️"
          label={t("admin.outside_every_zone")}
          value={areaZones.length === 0 ? "—" : anyUnrestricted ? `${uncovered}*` : uncovered}
          hint={
            areaZones.length === 0
              ? t("admin.set_boundary_to_see")
              : anyUnrestricted
                ? t("admin.unrestricted_still_reach")
                : t("admin.cant_order_any_store")
          }
          accent={uncovered > 0 ? "#dc2626" : "#404040"}
        />
      </div>

      <ZonesList cards={listCards} />
    </div>
  );
}
