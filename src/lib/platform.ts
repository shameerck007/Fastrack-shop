import { createClient } from "@/lib/supabase/server";

// Platform-owner analytics. The functions behind these (migration 0054) refuse anyone who is
// not a super_admin and group every figure by market, so currencies are never mixed.

type Result = Promise<{ data: unknown; error: { message: string } | null }>;
type Loose = { rpc: (fn: string, args?: object) => Result };

async function rpc<T>(fn: string, args?: object): Promise<T[]> {
  const db = (await createClient()) as unknown as Loose;
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export interface MarketSummary {
  tenant_id: string;
  slug: string;
  name: string;
  country_code: string;
  currency: string;
  status: "draft" | "active" | "suspended";
  orders_total: number;
  orders_today: number;
  orders_30d: number;
  delivered_30d: number;
  cancelled_30d: number;
  gmv_today: number;
  gmv_30d: number;
  avg_order_30d: number;
  delivery_fees_30d: number;
  tax_30d: number;
  commission_30d: number;
  suppliers_active: number;
  suppliers_pending: number;
  riders_approved: number;
  riders_pending: number;
  riders_online: number;
  customers_total: number;
  customers_new_30d: number;
  products_active: number;
  supplier_payable: number;
  rider_cash_held: number;
}

export interface SalesDay {
  tenant_id: string;
  day: string;
  orders: number;
  gmv: number;
  delivery_fees: number;
  tax: number;
}

export interface TopSupplier {
  tenant_id: string;
  store_id: string;
  store_name: string;
  orders: number;
  gross_sales: number;
  commission: number;
}

export interface StatusCount {
  tenant_id: string;
  status: string;
  cnt: number;
}

export interface Attention {
  tenant_id: string;
  kind: "orders_waiting_confirmation" | "ready_no_rider" | "supplier_applications" | "rider_applications";
  cnt: number;
}

const num = (v: unknown) => Number(v ?? 0);

export async function getMarketSummaries(): Promise<MarketSummary[]> {
  const rows = await rpc<Record<string, unknown>>("platform_market_summary");
  return rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    for (const k of Object.keys(r)) if (!["tenant_id", "slug", "name", "country_code", "currency", "status"].includes(k)) out[k] = num(r[k]);
    return out as unknown as MarketSummary;
  });
}

export async function getSalesByDay(days: number): Promise<SalesDay[]> {
  const rows = await rpc<Record<string, unknown>>("platform_sales_by_day", { p_days: days });
  return rows.map((r) => ({
    tenant_id: String(r.tenant_id),
    day: String(r.day),
    orders: num(r.orders),
    gmv: num(r.gmv),
    delivery_fees: num(r.delivery_fees),
    tax: num(r.tax),
  }));
}

export async function getTopSuppliers(days = 30, limit = 5): Promise<TopSupplier[]> {
  const rows = await rpc<Record<string, unknown>>("platform_top_suppliers", { p_days: days, p_limit: limit });
  return rows.map((r) => ({
    tenant_id: String(r.tenant_id),
    store_id: String(r.store_id),
    store_name: String(r.store_name),
    orders: num(r.orders),
    gross_sales: num(r.gross_sales),
    commission: num(r.commission),
  }));
}

export async function getStatusCounts(): Promise<StatusCount[]> {
  const rows = await rpc<Record<string, unknown>>("platform_status_counts");
  return rows.map((r) => ({ tenant_id: String(r.tenant_id), status: String(r.status), cnt: num(r.cnt) }));
}

export async function getAttention(): Promise<Attention[]> {
  const rows = await rpc<Record<string, unknown>>("platform_attention");
  return rows.map((r) => ({ tenant_id: String(r.tenant_id), kind: r.kind as Attention["kind"], cnt: num(r.cnt) }));
}

/** Fills the days with no sales, so a trend chart has one bar per day. */
export function fillDays(rows: SalesDay[], days: number, tz: "Asia/Riyadh" | "Asia/Kolkata"): { date: string; revenue: number; orders: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: { date: string; revenue: number; orders: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    const r = byDay.get(key);
    out.push({ date: key, revenue: r?.gmv ?? 0, orders: r?.orders ?? 0 });
  }
  return out;
}
