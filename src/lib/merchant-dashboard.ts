import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant-server";
import { timeZoneFor } from "@/lib/admin-dashboard";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DayPoint {
  /** YYYY-MM-DD in the market's time zone. */
  day: string;
  sales: number;
  orders: number;
}

export interface TopProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  revenue: number;
  units: number;
}

export interface SalesOverview {
  /** The last 30 days, oldest first, every day present (zero when nothing sold). */
  days: DayPoint[];
  sales30: number;
  salesPrev30: number;
  orders30: number;
  ordersPrev30: number;
  top: TopProduct[];
}

const dayKey = (d: Date, tz: string) => d.toLocaleDateString("en-CA", { timeZone: tz });

/** Sales from this supplier's own items on orders that were not cancelled: the last 30 days, and the 30 before for comparison. */
export async function getSalesOverview(storeId: string): Promise<SalesOverview> {
  const supabase = (await createClient()) as any;
  const tenant = await getCurrentTenant().catch(() => null);
  const tz = timeZoneFor(tenant?.country_code);
  const now = new Date();
  const since = new Date(now.getTime() - 61 * 86400_000);

  const { data } = await supabase
    .from("order_items")
    .select("order_id, line_total, ordered_quantity, orders!inner(created_at, status), product_variants!order_items_variant_id_fkey!inner(products!inner(id, name, image_url, store_id))")
    .eq("product_variants.products.store_id", storeId)
    .gte("orders.created_at", since.toISOString())
    .neq("orders.status", "cancelled")
    .limit(10000);

  const keys: string[] = [];
  for (let i = 29; i >= 0; i--) keys.push(dayKey(new Date(now.getTime() - i * 86400_000), tz));
  const idx = new Map(keys.map((k, i) => [k, i]));
  const days: DayPoint[] = keys.map((day) => ({ day, sales: 0, orders: 0 }));
  const ordersByDay: Set<string>[] = keys.map(() => new Set());
  const cutoff = new Date(now.getTime() - 30 * 86400_000);
  let salesPrev = 0;
  const ordersPrev = new Set<string>();
  const orders30 = new Set<string>();
  const byProduct = new Map<string, TopProduct>();

  for (const r of (data ?? []) as any[]) {
    const at = new Date(r.orders.created_at);
    const amount = Number(r.line_total);
    if (at >= cutoff) {
      const i = idx.get(dayKey(at, tz));
      if (i !== undefined) {
        days[i].sales += amount;
        ordersByDay[i].add(r.order_id);
      }
      orders30.add(r.order_id);
      const p = r.product_variants?.products;
      if (p) {
        const t = byProduct.get(p.id) ?? { id: p.id, name: p.name, imageUrl: p.image_url ?? null, revenue: 0, units: 0 };
        t.revenue += amount;
        t.units += Number(r.ordered_quantity);
        byProduct.set(p.id, t);
      }
    } else {
      salesPrev += amount;
      ordersPrev.add(r.order_id);
    }
  }
  days.forEach((d, i) => {
    d.orders = ordersByDay[i].size;
    d.sales = Math.round(d.sales * 100) / 100;
  });
  return {
    days,
    sales30: Math.round(days.reduce((s, d) => s + d.sales, 0) * 100) / 100,
    salesPrev30: Math.round(salesPrev * 100) / 100,
    orders30: orders30.size,
    ordersPrev30: ordersPrev.size,
    top: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  };
}

export interface LowStockItem {
  productId: string;
  name: string;
  label: string;
  imageUrl: string | null;
  stock: number;
  minStock: number;
}

/** The pack sizes at or below their minimum stock, the most urgent first. */
export async function getLowStockItems(storeId: string, limit = 6): Promise<{ items: LowStockItem[]; total: number }> {
  const supabase = (await createClient()) as any;
  const { data } = await supabase
    .from("inventory")
    .select("stock, min_stock, product_variants!inner(label, products!inner(id, name, image_url, store_id, is_active))")
    .eq("product_variants.products.store_id", storeId)
    .limit(5000);
  const rows = ((data ?? []) as any[])
    .filter((r) => Number(r.stock) < Number(r.min_stock) && r.product_variants?.products?.is_active)
    .map((r) => ({
      productId: r.product_variants.products.id as string,
      name: r.product_variants.products.name as string,
      label: r.product_variants.label as string,
      imageUrl: (r.product_variants.products.image_url as string | null) ?? null,
      stock: Number(r.stock),
      minStock: Number(r.min_stock),
    }))
    .sort((a, b) => a.stock / Math.max(1, a.minStock) - b.stock / Math.max(1, b.minStock));
  return { items: rows.slice(0, limit), total: rows.length };
}

/** Returns that have reached this supplier and are waiting to be checked in. */
export async function getReturnsWaiting(storeId: string): Promise<number> {
  const supabase = (await createClient()) as any;
  const { count } = await supabase.from("order_returns").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("return_to", "supplier").eq("status", "picked_up").is("received_at", null);
  return count ?? 0;
}

/** How a number compares with the period before it, as a percent (null when there is nothing to compare with). */
export function deltaPercent(now: number, before: number): number | null {
  if (before <= 0) return now > 0 ? null : 0;
  return Math.round(((now - before) / before) * 100);
}
