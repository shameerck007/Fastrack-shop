import { createClient } from "@/lib/supabase/server";

export interface DailyRevenuePoint {
  date: string; // yyyy-mm-dd
  revenue: number;
  orders: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface RankedItem {
  label: string;
  value: number;
}

export interface AdminAnalytics {
  dailyRevenue: DailyRevenuePoint[]; // last 14 days, oldest first
  statusCounts: StatusCount[]; // last 30 days
  topProducts: RankedItem[]; // top 5 by revenue, last 30 days
  topCategories: RankedItem[]; // top 5 by revenue, last 30 days
  revenue30d: number;
  orders30d: number;
  avgOrderValue30d: number;
  totalCustomers: number;
  newCustomers30d: number;
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const supabase = await createClient();

  // All date math here is done in UTC and matched against created_at's UTC
  // day (via toISOString/slice) — created_at is a timestamptz, so mixing in
  // local-time Date methods (setDate/setHours) while keying buckets off the
  // UTC string caused an off-by-one day shift for any server timezone other
  // than UTC, silently dropping "today" out of the 14-day window entirely.
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start30 = new Date(todayUTC);
  start30.setUTCDate(start30.getUTCDate() - 30);
  const start14 = new Date(todayUTC);
  start14.setUTCDate(start14.getUTCDate() - 13);

  const [{ data: orders30 }, { count: totalCustomers }, { count: newCustomers30d }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, created_at, total, status")
      .gte("created_at", start30.toISOString())
      .neq("status", "cancelled"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "customer"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer")
      .gte("created_at", start30.toISOString()),
  ]);

  const orders = orders30 ?? [];
  const orderIds = orders.map((o) => o.id);

  const { data: itemRows } = orderIds.length
    ? await supabase
        .from("order_items")
        .select(
          "product_name, line_total, order_id, product_variants!variant_id(products(category:categories(name)))"
        )
        .in("order_id", orderIds)
    : { data: [] as never[] };

  // Revenue by day, last 14 days
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

  // Status breakdown, last 30 days (all statuses, including cancelled — re-fetch separately
  // since the revenue query above excludes cancelled orders)
  const { data: statusRows } = await supabase
    .from("orders")
    .select("status")
    .gte("created_at", start30.toISOString());
  const statusMap = new Map<string, number>();
  for (const row of statusRows ?? []) {
    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1);
  }
  const statusCounts: StatusCount[] = [...statusMap.entries()].map(([status, count]) => ({ status, count }));

  // Top products / categories by revenue
  const productTotals = new Map<string, number>();
  const categoryTotals = new Map<string, number>();
  for (const row of (itemRows ?? []) as unknown as {
    product_name: string;
    line_total: number;
    product_variants: { products: { category: { name: string } | null } | null } | null;
  }[]) {
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

  return {
    dailyRevenue,
    statusCounts,
    topProducts,
    topCategories,
    revenue30d: Math.round(revenue30d * 100) / 100,
    orders30d,
    avgOrderValue30d: Math.round(avgOrderValue30d * 100) / 100,
    totalCustomers: totalCustomers ?? 0,
    newCustomers30d: newCustomers30d ?? 0,
  };
}
