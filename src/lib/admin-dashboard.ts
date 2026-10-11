import { createClient } from "@/lib/supabase/server";

export interface Totals {
  revenue: number;
  orders: number;
  placed: number;
  cancelled: number;
  delivered: number;
  buyers: number;
  discounts: number;
  delivery_fees: number;
}
export interface DayPoint {
  date: string;
  revenue: number;
  orders: number;
}
export interface Ranked {
  label: string;
  value: number;
  qty?: number;
  orders?: number;
  commission?: number;
}
export interface DashboardData {
  days: number;
  start: string;
  today: string;
  cur: Totals;
  prev: Totals;
  commission: { cur: number; prev: number };
  signups: { cur: number; prev: number; total: number };
  series: DayPoint[];
  series_prev: DayPoint[];
  status: Record<string, number>;
  delivery_types: Record<string, number>;
  /** [isoWeekday 1-7, hour 0-23, orders] */
  heat: [number, number, number][];
  top_categories: Ranked[];
  top_products: Ranked[];
  top_suppliers: Ranked[];
  sales_source: { fastrack?: number; suppliers?: number };
  buyers_split: { returning: number; new: number };
  attention: { pending_orders: number; awaiting_rider: number; out_for_delivery: number; low_stock: number; pending_merchants: number; pending_riders: number };
  recent: { id: string; order_number: string; status: string; total: number; created_at: string; delivery_type: string }[];
}

/** The market's own clock, so "today" and the busy hours are the shop's, not the server's. */
export function timeZoneFor(countryCode: string | null | undefined): string {
  return countryCode === "IN" ? "Asia/Kolkata" : countryCode === "SA" || !countryCode ? "Asia/Riyadh" : "UTC";
}

/** Everything on the business dashboard in one database call; null until migration 0083 is in. */
export async function getAdminDashboard(days: number, tz: string): Promise<DashboardData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard" as never, { p_days: days, p_tz: tz } as never);
  if (error || !data) return null;
  return data as unknown as DashboardData;
}

/** Change against the previous period, as a percentage; null when there is nothing to compare with. */
export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}
