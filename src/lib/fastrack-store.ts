import { createClient } from "@/lib/supabase/server";
import type { DailyRevenuePoint, RankedItem, StatusCount } from "@/lib/admin-analytics";

// "FasTrack Stores" = warehouses FasTrack owns directly (no stores row
// points at them — a merchant's warehouse always has one, created on
// approval). Each is a real pickup location a rider collects from, so
// scoping by orders.warehouse_id (which order was packed where) is both
// simpler and more accurate than the old approach of matching on
// products.store_id — an order's warehouse_id is already the single
// source of truth for "which location fulfilled this."
export interface FastrackWarehouseRow {
  id: string;
  name: string;
  address_line: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  delivery_radius_km: number | null;
  is_default: boolean; // the one default_warehouse_id() actually routes new orders to
  orders30d: number;
  revenue30d: number;
}

export async function getFastrackWarehouses(): Promise<FastrackWarehouseRow[]> {
  const supabase = await createClient();

  const now = new Date();
  const start30 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start30.setUTCDate(start30.getUTCDate() - 30);

  const [{ data: warehouses }, { data: stores }, { data: defaultId }, { data: orders }] = await Promise.all([
    supabase
      .from("warehouses")
      .select("id, name, address_line, lat, lng, is_active, delivery_radius_km")
      .order("created_at", { ascending: true }),
    supabase.from("stores").select("warehouse_id"),
    supabase.rpc("default_warehouse_id"),
    supabase
      .from("orders")
      .select("warehouse_id, total, status")
      .gte("created_at", start30.toISOString())
      .neq("status", "cancelled"),
  ]);

  const merchantWarehouseIds = new Set((stores ?? []).map((s) => s.warehouse_id).filter(Boolean));
  const ownWarehouses = (warehouses ?? []).filter((w) => !merchantWarehouseIds.has(w.id));

  const statsByWarehouse = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders ?? []) {
    if (!o.warehouse_id) continue;
    const s = statsByWarehouse.get(o.warehouse_id) ?? { orders: 0, revenue: 0 };
    s.orders += 1;
    s.revenue += Number(o.total);
    statsByWarehouse.set(o.warehouse_id, s);
  }

  return ownWarehouses.map((w) => {
    const s = statsByWarehouse.get(w.id);
    return {
      ...w,
      is_default: w.id === defaultId,
      orders30d: s?.orders ?? 0,
      revenue30d: Math.round((s?.revenue ?? 0) * 100) / 100,
    };
  });
}

export interface FastrackStoreAnalytics {
  warehouse: FastrackWarehouseRow | null;
  dailyRevenue: DailyRevenuePoint[]; // last 14 days, oldest first
  statusCounts: StatusCount[]; // last 30 days
  topProducts: RankedItem[];
  topCategories: RankedItem[];
  revenue30d: number;
  orders30d: number;
  avgOrderValue30d: number;
  lowStockCount: number;
  recentOrders: { id: string; order_number: string; created_at: string; status: string; total: number }[];
}

interface ItemRow {
  order_id: string;
  product_name: string;
  line_total: number;
  product_variants: { products: { category: { name: string } | null } | null } | null;
}

export async function getFastrackStoreAnalytics(warehouseId: string): Promise<FastrackStoreAnalytics> {
  const supabase = await createClient();

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start30 = new Date(todayUTC);
  start30.setUTCDate(start30.getUTCDate() - 30);
  const start14 = new Date(todayUTC);
  start14.setUTCDate(start14.getUTCDate() - 13);

  const [warehouses, { data: orders30 }] = await Promise.all([
    getFastrackWarehouses(),
    supabase
      .from("orders")
      .select("id, order_number, created_at, status, total")
      .eq("warehouse_id", warehouseId)
      .gte("created_at", start30.toISOString())
      .neq("status", "cancelled"),
  ]);

  const warehouse = warehouses.find((w) => w.id === warehouseId) ?? null;
  const orders = orders30 ?? [];
  const orderIds = orders.map((o) => o.id);
  const orderById = new Map(orders.map((o) => [o.id, o]));

  const { data: itemRows } = orderIds.length
    ? await supabase
        .from("order_items")
        .select("order_id, product_name, line_total, product_variants!variant_id(products(category:categories(name)))")
        .in("order_id", orderIds)
    : { data: [] as never[] };

  const dayBuckets = new Map<string, { revenue: number; orders: number }>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(start14);
    d.setUTCDate(d.getUTCDate() + i);
    dayBuckets.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  }
  for (const o of orders) {
    const key = o.created_at.slice(0, 10);
    const bucket = dayBuckets.get(key);
    if (bucket) {
      bucket.revenue += Number(o.total);
      bucket.orders += 1;
    }
  }
  const dailyRevenue: DailyRevenuePoint[] = [...dayBuckets.entries()].map(([date, v]) => ({
    date,
    revenue: Math.round(v.revenue * 100) / 100,
    orders: v.orders,
  }));

  const statusMap = new Map<string, number>();
  for (const o of orders) statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1);
  const statusCounts: StatusCount[] = [...statusMap.entries()].map(([status, count]) => ({ status, count }));

  const productTotals = new Map<string, number>();
  const categoryTotals = new Map<string, number>();
  for (const row of (itemRows ?? []) as unknown as ItemRow[]) {
    if (!orderById.has(row.order_id)) continue;
    productTotals.set(row.product_name, (productTotals.get(row.product_name) ?? 0) + Number(row.line_total));
    const categoryName = row.product_variants?.products?.category?.name ?? "Uncategorized";
    categoryTotals.set(categoryName, (categoryTotals.get(categoryName) ?? 0) + Number(row.line_total));
  }
  const topProducts = [...productTotals.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const topCategories = [...categoryTotals.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const revenue30d = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const orders30d = orders.length;
  const avgOrderValue30d = orders30d > 0 ? revenue30d / orders30d : 0;

  const recentOrders = [...orders]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 6)
    .map((o) => ({ id: o.id, order_number: o.order_number, created_at: o.created_at, status: o.status, total: Number(o.total) }));

  const { data: stockRows } = await supabase.from("inventory").select("stock, min_stock").eq("warehouse_id", warehouseId);
  const lowStockCount = (stockRows ?? []).filter((r) => Number(r.stock) < Number(r.min_stock)).length;

  return {
    warehouse,
    dailyRevenue,
    statusCounts,
    topProducts,
    topCategories,
    revenue30d: Math.round(revenue30d * 100) / 100,
    orders30d,
    avgOrderValue30d: Math.round(avgOrderValue30d * 100) / 100,
    lowStockCount,
    recentOrders,
  };
}
