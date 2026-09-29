import { createClient } from "@/lib/supabase/server";
import type { DailyRevenuePoint, RankedItem, StatusCount } from "@/lib/admin-analytics";

// "FasTrack Stores" — the admin's own dark-store inventory, i.e. products
// with no store_id (not owned by any third-party merchant). The main admin
// dashboard blends this together with every marketplace seller's sales into
// one number; this mirrors that dashboard's analytics shape but scoped to
// FasTrack's own items only, the same way admin/merchants/[id] gives a
// third-party seller their own isolated view.
export interface FastrackStoreAnalytics {
  dailyRevenue: DailyRevenuePoint[]; // last 14 days, oldest first — FasTrack's own item revenue per day
  statusCounts: StatusCount[]; // last 30 days, orders containing a FasTrack item
  topProducts: RankedItem[];
  topCategories: RankedItem[];
  revenue30d: number;
  orders30d: number; // distinct orders containing at least one FasTrack item
  avgOrderValue30d: number; // based on FasTrack's own item revenue, not the whole order total
  totalProducts: number;
  lowStockCount: number;
  recentOrders: { id: string; order_number: string; created_at: string; status: string; ownSubtotal: number }[];
}

interface ItemRow {
  order_id: string;
  product_name: string;
  line_total: number;
  product_variants: {
    products: { store_id: string | null; category: { name: string } | null } | null;
  } | null;
  orders: { order_number: string; created_at: string; status: string } | null;
}

export async function getFastrackStoreAnalytics(): Promise<FastrackStoreAnalytics> {
  const supabase = await createClient();

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start30 = new Date(todayUTC);
  start30.setUTCDate(start30.getUTCDate() - 30);
  const start14 = new Date(todayUTC);
  start14.setUTCDate(start14.getUTCDate() - 13);

  const [{ data: rawItems }, { count: totalProducts }, { data: defaultWarehouseId }] = await Promise.all([
    supabase
      .from("order_items")
      .select(
        "order_id, product_name, line_total, product_variants!variant_id(products(store_id, category:categories(name))), orders!inner(order_number, created_at, status)"
      )
      .gte("orders.created_at", start30.toISOString()),
    supabase.from("products").select("*", { count: "exact", head: true }).is("store_id", null),
    supabase.rpc("default_warehouse_id"),
  ]);

  // Filtered here rather than in the query itself — PostgREST can't filter
  // on a column two levels deep into an embedded resource (order_items ->
  // product_variants -> products.store_id) in a single .is() call.
  const items = ((rawItems ?? []) as unknown as ItemRow[]).filter(
    (r) => r.product_variants?.products?.store_id === null && r.orders
  );

  const dayBuckets = new Map<string, { revenue: number; orders: number }>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(start14);
    d.setUTCDate(d.getUTCDate() + i);
    dayBuckets.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  }
  const ordersSeenPerDay = new Map<string, Set<string>>();

  const orderMeta = new Map<string, { order_number: string; created_at: string; status: string }>();
  const orderRevenue = new Map<string, number>();
  const productTotals = new Map<string, number>();
  const categoryTotals = new Map<string, number>();

  for (const row of items) {
    const order = row.orders!;
    if (order.status === "cancelled") continue;

    orderMeta.set(row.order_id, order);
    orderRevenue.set(row.order_id, (orderRevenue.get(row.order_id) ?? 0) + Number(row.line_total));
    productTotals.set(row.product_name, (productTotals.get(row.product_name) ?? 0) + Number(row.line_total));
    const categoryName = row.product_variants?.products?.category?.name ?? "Uncategorized";
    categoryTotals.set(categoryName, (categoryTotals.get(categoryName) ?? 0) + Number(row.line_total));

    const dayKey = order.created_at.slice(0, 10);
    const bucket = dayBuckets.get(dayKey);
    if (bucket) {
      bucket.revenue += Number(row.line_total);
      const seen = ordersSeenPerDay.get(dayKey) ?? new Set<string>();
      if (!seen.has(row.order_id)) {
        seen.add(row.order_id);
        bucket.orders += 1;
      }
      ordersSeenPerDay.set(dayKey, seen);
    }
  }

  const dailyRevenue: DailyRevenuePoint[] = [...dayBuckets.entries()].map(([date, v]) => ({
    date,
    revenue: Math.round(v.revenue * 100) / 100,
    orders: v.orders,
  }));

  const statusMap = new Map<string, number>();
  for (const meta of orderMeta.values()) {
    statusMap.set(meta.status, (statusMap.get(meta.status) ?? 0) + 1);
  }
  const statusCounts: StatusCount[] = [...statusMap.entries()].map(([status, count]) => ({ status, count }));

  const topProducts = [...productTotals.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const topCategories = [...categoryTotals.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const revenue30d = [...orderRevenue.values()].reduce((sum, v) => sum + v, 0);
  const orders30d = orderMeta.size;
  const avgOrderValue30d = orders30d > 0 ? revenue30d / orders30d : 0;

  const recentOrders = [...orderMeta.entries()]
    .map(([id, meta]) => ({ id, ...meta, ownSubtotal: Math.round((orderRevenue.get(id) ?? 0) * 100) / 100 }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 6);

  // Low stock: inventory rows at FasTrack's own default warehouse, for
  // products it owns directly (store_id is null).
  let lowStockCount = 0;
  if (defaultWarehouseId) {
    const { data: stockRows } = await supabase
      .from("inventory")
      .select("stock, min_stock, product_variants!variant_id(products(store_id))")
      .eq("warehouse_id", defaultWarehouseId as string);
    lowStockCount = ((stockRows ?? []) as unknown as { stock: number; min_stock: number; product_variants: { products: { store_id: string | null } | null } | null }[]).filter(
      (r) => r.product_variants?.products?.store_id === null && Number(r.stock) < Number(r.min_stock)
    ).length;
  }

  return {
    dailyRevenue,
    statusCounts,
    topProducts,
    topCategories,
    revenue30d: Math.round(revenue30d * 100) / 100,
    orders30d,
    avgOrderValue30d: Math.round(avgOrderValue30d * 100) / 100,
    totalProducts: totalProducts ?? 0,
    lowStockCount,
    recentOrders,
  };
}
