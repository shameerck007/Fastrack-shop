import Link from "next/link";
import PageHero from "@/components/PageHero";
import RevenueTrendChart from "@/components/admin/charts/RevenueTrendChart";
import BarList from "@/components/admin/charts/BarList";
import { findCountry } from "@/lib/countries";
import { moneyFor } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/utils";
import {
  fillDays,
  getAttention,
  getMarketSummaries,
  getSalesByDay,
  getStatusCounts,
  getTopSuppliers,
  type Attention,
  type MarketSummary,
  type SalesDay,
  type StatusCount,
  type TopSupplier,
} from "@/lib/platform";

const STATUS_COLORS: Record<string, string> = {
  pending: "#bfdbfe",
  confirmed: "#93c5fd",
  preparing: "#60a5fa",
  ready_for_pickup: "#3b82f6",
  rider_assigned: "#2563eb",
  out_for_delivery: "#1d4ed8",
  delivered: "#059669",
  cancelled: "#dc2626",
};
const STATUS_ORDER = ["pending", "confirmed", "preparing", "ready_for_pickup", "rider_assigned", "out_for_delivery", "delivered", "cancelled"];

const ATTENTION: Record<Attention["kind"], { icon: string; label: string; href: string }> = {
  orders_waiting_confirmation: { icon: "⏱️", label: "Orders waiting over 10 min for the supplier", href: "/admin/orders" },
  ready_no_rider: { icon: "📦", label: "Ready for pickup, no rider for 10+ min", href: "/admin/orders" },
  supplier_applications: { icon: "🏪", label: "Supplier applications to review", href: "/admin/merchants" },
  rider_applications: { icon: "🛵", label: "Rider applications to review", href: "/admin/riders" },
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-amber-50 text-amber-700",
  suspended: "bg-red-50 text-red-700",
};

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-extrabold leading-tight tracking-tight ${tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : "text-neutral-900"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2">
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p className="text-sm font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function MarketPanel({ m, sales, status, suppliers }: { m: MarketSummary; sales: SalesDay[]; status: StatusCount[]; suppliers: TopSupplier[] }) {
  const money = moneyFor(m.currency);
  const country = findCountry(m.country_code);
  const tz = m.country_code === "IN" ? "Asia/Kolkata" : "Asia/Riyadh";
  const trend = fillDays(sales, 14, tz);
  const statusItems = STATUS_ORDER.map((s) => ({
    label: ORDER_STATUS_LABELS[s] ?? s,
    value: status.find((x) => x.status === s)?.cnt ?? 0,
    color: STATUS_COLORS[s],
  })).filter((i) => i.value > 0);
  const deliveredRate = m.orders_30d > 0 ? Math.round((m.delivered_30d / m.orders_30d) * 100) : null;

  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{country.flag}</span>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-neutral-900">{m.name}</h2>
            <p className="text-xs text-neutral-500">
              {country.name} · {m.currency}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[m.status] ?? "bg-neutral-100"}`}>
            {m.status === "draft" ? "Draft — hidden from customers" : m.status === "active" ? "Live" : "Suspended"}
          </span>
          <Link href="/platform/markets" className="text-xs font-semibold text-blue-700 hover:underline">
            Manage
          </Link>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Sales today" value={money(m.gmv_today)} hint={`${m.orders_today} orders`} />
          <Kpi label="Sales · 30 days" value={money(m.gmv_30d)} hint={`${m.orders_30d} orders`} />
          <Kpi label="Avg order value" value={money(m.avg_order_30d)} hint="30 days" />
          <Kpi label="Delivered" value={deliveredRate === null ? "—" : `${deliveredRate}%`} hint={`${m.delivered_30d} delivered · ${m.cancelled_30d} cancelled`} tone={deliveredRate !== null && deliveredRate >= 80 ? "good" : undefined} />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Platform commission · 30d" value={money(m.commission_30d)} />
          <MiniStat label="Delivery fees · 30d" value={money(m.delivery_fees_30d)} />
          <MiniStat label={m.country_code === "IN" ? "GST collected · 30d" : "VAT collected · 30d"} value={money(m.tax_30d)} />
          <MiniStat label="Total orders" value={String(m.orders_total)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className={`rounded-2xl border p-4 ${m.supplier_payable > 0 ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-neutral-50"}`}>
            <p className="text-xs font-medium text-neutral-600">We owe suppliers</p>
            <p className="text-xl font-extrabold text-neutral-900">{money(m.supplier_payable)}</p>
            <p className="text-[11px] text-neutral-500">Delivered sales after commission, minus payouts made</p>
          </div>
          <div className={`rounded-2xl border p-4 ${m.rider_cash_held > 0 ? "border-red-200 bg-red-50" : "border-neutral-200 bg-neutral-50"}`}>
            <p className="text-xs font-medium text-neutral-600">Cash riders still hold</p>
            <p className="text-xl font-extrabold text-neutral-900">{money(m.rider_cash_held)}</p>
            <p className="text-[11px] text-neutral-500">Cash-on-delivery collected, not yet handed in</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Suppliers" value={`${m.suppliers_active} live${m.suppliers_pending ? ` · ${m.suppliers_pending} pending` : ""}`} />
          <MiniStat label="Riders" value={`${m.riders_approved} approved · ${m.riders_online} online`} />
          <MiniStat label="Customers" value={`${m.customers_total}${m.customers_new_30d ? ` · +${m.customers_new_30d} new` : ""}`} />
          <MiniStat label="Active products" value={String(m.products_active)} />
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-bold text-neutral-800">Sales trend</p>
            <span className="text-xs text-neutral-400">last 14 days</span>
          </div>
          <RevenueTrendChart data={trend} money={money} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <p className="mb-3 text-sm font-bold text-neutral-800">Orders by status · 30 days</p>
            <BarList items={statusItems} formatValue={(v) => String(v)} emptyLabel="No orders yet" />
          </div>
          <div className="rounded-2xl border border-neutral-200 p-4">
            <p className="mb-3 text-sm font-bold text-neutral-800">Top suppliers · 30 days</p>
            {suppliers.length === 0 ? (
              <p className="text-sm text-neutral-400">No supplier sales yet</p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {suppliers.map((s, i) => (
                  <li key={s.store_id} className="flex items-center gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">{s.store_name}</span>
                    <span className="shrink-0 text-xs text-neutral-400">{s.orders} orders</span>
                    <span className="shrink-0 font-bold text-neutral-900">{money(s.gross_sales)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function PlatformOverviewPage() {
  const [markets, sales, status, suppliers, attention] = await Promise.all([
    getMarketSummaries(),
    getSalesByDay(14),
    getStatusCounts(),
    getTopSuppliers(30, 5),
    getAttention(),
  ]);
  const nameOf = (tenantId: string) => markets.find((m) => m.tenant_id === tenantId)?.name ?? "—";

  const attentionKinds = (Object.keys(ATTENTION) as Attention["kind"][]).map((kind) => ({
    kind,
    rows: attention.filter((a) => a.kind === kind && a.cnt > 0),
  }));
  const attentionTotal = attention.reduce((n, a) => n + a.cnt, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        icon="🌍"
        title="Platform overview"
        subtitle="Every market side by side. Each market's money is shown in its own currency and never added to another's."
        chips={markets.map((m) => `${findCountry(m.country_code).flag} ${m.name} · ${m.status === "active" ? "Live" : m.status}`)}
      />

      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold tracking-tight">Needs your attention</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${attentionTotal > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            {attentionTotal > 0 ? `${attentionTotal} item${attentionTotal === 1 ? "" : "s"}` : "All clear"}
          </span>
        </div>
        {attentionTotal === 0 ? (
          <p className="text-sm text-neutral-500">Nothing is waiting: no late orders and no applications to review.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {attentionKinds
              .filter((k) => k.rows.length > 0)
              .map(({ kind, rows }) => (
                <Link key={kind} href={ATTENTION[kind].href} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:shadow-md">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">{ATTENTION[kind].icon}</span>
                  <span className="min-w-0">
                    <span className="block text-2xl font-extrabold leading-tight text-neutral-900">{rows.reduce((n, r) => n + r.cnt, 0)}</span>
                    <span className="block text-sm font-medium text-neutral-800">{ATTENTION[kind].label}</span>
                    <span className="block text-xs text-neutral-500">{rows.map((r) => `${nameOf(r.tenant_id)}: ${r.cnt}`).join(" · ")}</span>
                  </span>
                </Link>
              ))}
          </div>
        )}
      </section>

      {markets.map((m) => (
        <MarketPanel
          key={m.tenant_id}
          m={m}
          sales={sales.filter((s) => s.tenant_id === m.tenant_id)}
          status={status.filter((s) => s.tenant_id === m.tenant_id)}
          suppliers={suppliers.filter((s) => s.tenant_id === m.tenant_id)}
        />
      ))}
    </div>
  );
}
