import { createClient } from "@/lib/supabase/server";
import ZoneEditor from "@/components/admin/ZoneEditor";
import ZonesOverviewMap, { type OverviewZone } from "@/components/admin/ZonesOverviewMap";
import { distanceKm } from "@/lib/delivery-geo";

const COLORS = ["#1d4ed8", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#dc2626"];

interface WarehouseRow {
  id: string;
  name: string;
  address_line: string | null;
  lat: number | null;
  lng: number | null;
  delivery_radius_km: number | null;
}

function Stat({ label, value, hint, tone = "text-neutral-900" }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

export default async function AdminZonesPage() {
  const supabase = await createClient();
  const [{ data: warehouses }, { data: stores }, { data: products }, { data: orders }, { data: addresses }] =
    await Promise.all([
      supabase
        .from("warehouses")
        .select("id, name, address_line, lat, lng, delivery_radius_km")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase.from("stores").select("id, name, warehouse_id, contact_phone, address_line, status"),
      supabase.from("products").select("store_id").eq("is_active", true),
      supabase.from("orders").select("warehouse_id").limit(5000),
      supabase.from("addresses").select("lat, lng").not("lat", "is", null).limit(5000),
    ]);

  const rows = (warehouses ?? []) as WarehouseRow[];
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
    const inside =
      zoned && radius != null
        ? pins.filter((p) => distanceKm(w.lat as number, w.lng as number, p.lat, p.lng) <= radius).length
        : null;
    return {
      w,
      store,
      zoned,
      radius,
      inside,
      color: COLORS[index % COLORS.length],
      productCount: store ? (productsByStore.get(store.id) ?? 0) : (productsByStore.get(null) ?? 0),
      orderCount: ordersByWarehouse.get(w.id) ?? 0,
      displayName: store?.name ?? "FasTrack (own products)",
    };
  });

  cards.sort((a, b) => Number(a.zoned) - Number(b.zoned));

  const overviewZones: OverviewZone[] = cards
    .filter((c) => c.zoned)
    .map((c) => ({
      id: c.w.id,
      name: c.displayName,
      lat: c.w.lat as number,
      lng: c.w.lng as number,
      radiusKm: c.radius as number,
      color: c.color,
    }));

  const zonedCount = cards.filter((c) => c.zoned).length;
  const uncovered = pins.filter(
    (p) => overviewZones.length > 0 && !overviewZones.some((z) => distanceKm(z.lat, z.lng, p.lat, p.lng) <= z.radiusKm)
  ).length;
  const anyUnrestricted = cards.some((c) => !c.zoned);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Delivery zones</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Draw a delivery circle for each store. Customers outside a store&apos;s circle can&apos;t add its products to
        the cart or order them. A store with no boundary delivers everywhere.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Stores / warehouses" value={cards.length} />
        <Stat
          label="With a boundary"
          value={`${zonedCount} of ${cards.length}`}
          tone={zonedCount === cards.length ? "text-emerald-600" : "text-amber-600"}
          hint={zonedCount === cards.length ? "All configured" : `${cards.length - zonedCount} still unrestricted`}
        />
        <Stat label="Customer addresses pinned" value={pins.length} hint="Saved with a map location" />
        <Stat
          label="Outside every zone"
          value={overviewZones.length === 0 ? "—" : anyUnrestricted ? `${uncovered}*` : uncovered}
          tone={uncovered > 0 ? "text-red-600" : "text-neutral-900"}
          hint={
            overviewZones.length === 0
              ? "Set a boundary to see this"
              : anyUnrestricted
                ? "*Unrestricted stores still reach them"
                : "Can't order from any store"
          }
        />
      </div>

      <div className="mb-2">
        <ZonesOverviewMap zones={overviewZones} customerPoints={pins.map((p) => ({ lat: p.lat, lng: p.lng }))} />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
        {overviewZones.map((z) => (
          <span key={z.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
            {z.name} · {z.radiusKm} km
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-500" /> Customer address
        </span>
        {overviewZones.length === 0 && (
          <span className="text-neutral-400">No boundaries drawn yet — open a store below to set one.</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {cards.map((c) => (
          <details key={c.w.id} className="rounded-xl border border-neutral-200 bg-white" open={!c.zoned}>
            <summary className="flex cursor-pointer flex-wrap items-start justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
                <div>
                  <p className="font-medium">{c.displayName}</p>
                  <p className="text-xs text-neutral-400">{c.w.name}</p>
                  {(c.store?.address_line ?? c.w.address_line) && (
                    <p className="text-xs text-neutral-500">📍 {c.store?.address_line ?? c.w.address_line}</p>
                  )}
                  {c.store?.contact_phone && <p className="text-xs text-neutral-500">📞 {c.store.contact_phone}</p>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 text-right">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    c.zoned ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {c.zoned ? `Delivers within ${c.radius} km` : "No boundary — delivers everywhere"}
                </span>
                <span className="text-xs text-neutral-500">
                  {c.productCount} active products · {c.orderCount} orders
                  {c.inside != null && ` · ${c.inside} customer addresses inside`}
                </span>
              </div>
            </summary>
            <div className="border-t border-neutral-100 p-4">
              <ZoneEditor
                warehouseId={c.w.id}
                storeAddress={c.store?.address_line ?? c.w.address_line}
                initialLat={c.w.lat}
                initialLng={c.w.lng}
                initialRadiusKm={c.radius}
              />
            </div>
          </details>
        ))}
        {cards.length === 0 && <p className="text-sm text-neutral-500">No active warehouses yet.</p>}
      </div>
    </div>
  );
}
