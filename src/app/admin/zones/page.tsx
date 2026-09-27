import { createClient } from "@/lib/supabase/server";
import ZoneEditor from "@/components/admin/ZoneEditor";

interface WarehouseRow {
  id: string;
  name: string;
  address_line: string | null;
  lat: number | null;
  lng: number | null;
  delivery_radius_km: number | null;
  is_active: boolean;
}

export default async function AdminZonesPage() {
  const supabase = await createClient();
  const [{ data: warehouses }, { data: stores }] = await Promise.all([
    supabase
      .from("warehouses")
      .select("id, name, address_line, lat, lng, delivery_radius_km, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase.from("stores").select("name, warehouse_id"),
  ]);
  const storeByWarehouse = new Map((stores ?? []).map((s) => [s.warehouse_id, s.name as string]));
  const rows = (warehouses ?? []) as WarehouseRow[];

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Delivery zones</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Set a delivery circle for each store. Customers outside a store&apos;s circle can&apos;t add its products
        to the cart or order them. A store with no boundary delivers everywhere.
      </p>

      <div className="flex flex-col gap-3">
        {rows.map((w) => {
          const storeName = storeByWarehouse.get(w.id);
          const zoned = w.delivery_radius_km != null;
          return (
            <details key={w.id} className="rounded-xl border border-neutral-200 bg-white p-4" open={!zoned}>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{storeName ?? "FasTrack (own products)"}</span>
                  <span className="ml-2 text-xs text-neutral-400">{w.name}</span>
                  {w.address_line && <span className="block text-xs text-neutral-500">{w.address_line}</span>}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    zoned ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {zoned ? `Delivers within ${Number(w.delivery_radius_km)} km` : "No boundary — delivers everywhere"}
                </span>
              </summary>
              <div className="mt-4">
                <ZoneEditor
                  warehouseId={w.id}
                  initialLat={w.lat}
                  initialLng={w.lng}
                  initialRadiusKm={w.delivery_radius_km == null ? null : Number(w.delivery_radius_km)}
                />
              </div>
            </details>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-neutral-500">No active warehouses yet.</p>}
      </div>
    </div>
  );
}
