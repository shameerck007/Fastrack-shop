import Link from "@/components/Link";
import { PageHeader } from "@/components/admin/AdminUi";
import SalesChart from "@/components/admin/dashboard/SalesChart";
import Heatmap from "@/components/admin/dashboard/Heatmap";
import { Kpi, Panel, RankBars, SplitBar } from "@/components/admin/dashboard/Widgets";
import { getAdminDashboard, pctChange, timeZoneFor } from "@/lib/admin-dashboard";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getCurrentTenant, getMoney } from "@/lib/tenant-server";

export const metadata = { title: "Dashboard" };

const RANGES = [7, 30, 90] as const;

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
const STATUS_PILL: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  confirmed: "bg-blue-50 text-blue-700",
  preparing: "bg-blue-50 text-blue-700",
  ready_for_pickup: "bg-amber-50 text-amber-700",
  rider_assigned: "bg-amber-50 text-amber-700",
  out_for_delivery: "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-rose-50 text-rose-700",
};
const DELIVERY_COLORS: Record<string, { label: string; color: string }> = {
  express: { label: "Express", color: "#2563eb" },
  standard: { label: "Standard", color: "#93c5fd" },
  scheduled: { label: "Scheduled", color: "#c4b5fd" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const asked = Number(sp.range);
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30;
  const [money, locale, tenant] = await Promise.all([getMoney(), getServerLocale(), getCurrentTenant()]);
  const t = (key: string) => translate(locale, key);
  const data = await getAdminDashboard(days, timeZoneFor(tenant?.country_code));

  const rangeSwitch = (
    <div className="inline-flex rounded-full border border-neutral-200 bg-white p-0.5 shadow-sm" role="tablist" aria-label="Period">
      {RANGES.map((r) => (
        <Link key={r} href={r === 30 ? "/admin" : `/admin?range=${r}`} role="tab" aria-selected={r === days} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${r === days ? "bg-blue-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100"}`}>
          {r} days
        </Link>
      ))}
    </div>
  );

  if (!data) {
    return (
      <div>
        <PageHeader icon="📊" title="Business overview" subtitle="Sales, customers and operations at a glance." />
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          The business dashboard needs database migration <b>0083_admin_dashboard.sql</b>. Run it in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  const { cur, prev } = data;
  const aov = cur.orders ? cur.revenue / cur.orders : 0;
  const aovPrev = prev.orders ? prev.revenue / prev.orders : 0;
  const cancelRate = cur.placed ? (cur.cancelled / cur.placed) * 100 : 0;
  const cancelPrev = prev.placed ? (prev.cancelled / prev.placed) * 100 : 0;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const spark = (k: "revenue" | "orders") => data.series.map((d) => d[k]);

  const att = data.attention;
  const attention = [
    { n: att.pending_orders, label: "orders waiting to be confirmed", href: "/admin/orders", tone: "amber" },
    { n: att.awaiting_rider, label: "ready, waiting for a rider", href: "/admin/orders", tone: "amber" },
    { n: att.low_stock, label: "low-stock items", href: "/admin/products", tone: "rose" },
    { n: att.pending_merchants, label: "supplier applications", href: "/admin/merchants", tone: "blue" },
    { n: att.pending_riders, label: "rider applications", href: "/admin/users", tone: "blue" },
  ].filter((a) => a.n > 0);
  const TONE: Record<string, string> = { amber: "border-amber-200 bg-amber-50 text-amber-900", rose: "border-rose-200 bg-rose-50 text-rose-900", blue: "border-blue-200 bg-blue-50 text-blue-900" };

  const statusItems = STATUS_ORDER.filter((s) => (data.status[s] ?? 0) > 0).map((s) => ({ s, n: data.status[s] }));
  const maxStatus = Math.max(...statusItems.map((x) => x.n), 1);
  const deliveryParts = Object.entries(DELIVERY_COLORS).map(([k, v]) => ({ label: v.label, value: data.delivery_types[k] ?? 0, color: v.color }));
  const sourceParts = [
    { label: "Supplier shops", value: data.sales_source.suppliers ?? 0, color: "#2563eb" },
    { label: "FasTrack's own stock", value: data.sales_source.fastrack ?? 0, color: "#93c5fd" },
  ];
  const supplierTotal = data.top_suppliers.reduce((n, s) => n + s.value, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon="📊"
        title="Business overview"
        subtitle={`${shortDate(data.start)} – ${shortDate(data.today)}, compared with the ${days} days before.`}
        actions={rangeSwitch}
      />

      {attention.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Needs attention">
          {attention.map((a) => (
            <Link key={a.label} href={a.href} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition hover:shadow-sm ${TONE[a.tone]}`}>
              <b className="text-sm">{a.n}</b> {a.label} <span aria-hidden>→</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Sales" value={money(cur.revenue)} change={pctChange(cur.revenue, prev.revenue)} hint={`${cur.orders} orders, cancellations left out`} spark={spark("revenue")} />
        <Kpi label="Orders" value={String(cur.orders)} change={pctChange(cur.orders, prev.orders)} hint={`${cur.delivered} delivered`} spark={spark("orders")} color="#7c3aed" />
        <Kpi label="Average order" value={money(aov)} change={pctChange(aov, aovPrev)} hint="Sales per order" />
        <Kpi label="Active customers" value={String(cur.buyers)} change={pctChange(cur.buyers, prev.buyers)} hint="Ordered in this period" />
        <Kpi label="New sign-ups" value={String(data.signups.cur)} change={pctChange(data.signups.cur, data.signups.prev)} hint={`${data.signups.total} customers in total`} />
        <Kpi label="Commission earned" value={money(data.commission.cur)} change={pctChange(data.commission.cur, data.commission.prev)} hint="Kept from supplier sales" />
        <Kpi label="Discounts given" value={money(cur.discounts)} change={pctChange(cur.discounts, prev.discounts)} goodWhenDown hint="Offers and coupons" />
        <Kpi label="Cancellation rate" value={`${r1(cancelRate)}%`} change={pctChange(r1(cancelRate), r1(cancelPrev))} goodWhenDown hint={`${cur.cancelled} of ${cur.placed} orders`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Performance" className="lg:col-span-2">
          <SalesChart series={data.series} previous={data.series_prev} />
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="Order status" hint={`All orders placed in the last ${days} days`}>
            {statusItems.length === 0 ? (
              <p className="py-4 text-sm text-neutral-400">No orders in this period yet.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {statusItems.map(({ s, n }) => (
                  <li key={s} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 truncate text-xs text-neutral-600">{t(`order_status.${s}`)}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(4, (n / maxStatus) * 100)}%`, backgroundColor: STATUS_COLORS[s] }} />
                    </span>
                    <b className="w-7 shrink-0 text-end text-xs text-neutral-800">{n}</b>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Delivery mix" hint="How orders were delivered">
            <SplitBar parts={deliveryParts} />
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Top categories" hint="By sales">
          <RankBars items={data.top_categories.map((c) => ({ label: c.label, value: Number(c.value), sub: `${c.qty ?? 0} items sold` }))} format={money} />
        </Panel>
        <Panel title="Top products" hint="By sales">
          <RankBars items={data.top_products.map((p) => ({ label: p.label, value: Number(p.value), sub: `${p.qty ?? 0} sold` }))} format={money} />
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="Customers" hint="Who ordered in this period">
            <SplitBar
              parts={[
                { label: "Returning", value: data.buyers_split.returning, color: "#2563eb" },
                { label: "First-time", value: data.buyers_split.new, color: "#93c5fd" },
              ]}
            />
          </Panel>
          <Panel title="Where sales come from">
            <SplitBar parts={sourceParts} format={money} />
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="When customers order" hint="Orders by day and hour, in the shop's local time" className="lg:col-span-2">
          <Heatmap cells={data.heat} />
        </Panel>
        <Panel
          title="Latest orders"
          action={
            <Link href="/admin/orders" className="text-xs font-bold text-blue-700 hover:underline">
              View all →
            </Link>
          }
        >
          {data.recent.length === 0 ? (
            <p className="py-4 text-sm text-neutral-400">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-neutral-50">
                    <span className="min-w-0">
                      <span className="block font-bold text-neutral-900">#{o.order_number}</span>
                      <span className="block text-[11px] text-neutral-400">
                        {shortDate(o.created_at)} · {o.delivery_type}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <b className="text-neutral-900">{money(Number(o.total))}</b>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_PILL[o.status] ?? "bg-neutral-100 text-neutral-600"}`}>{t(`order_status.${o.status}`)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Supplier performance" hint="Best sellers in this period, with what FasTrack earned from each" action={<Link href="/admin/commission" className="text-xs font-bold text-blue-700 hover:underline">Commission rates →</Link>}>
        {data.top_suppliers.length === 0 ? (
          <p className="py-4 text-sm text-neutral-400">No sales in this period yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-start text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  <th className="py-2 pe-3 text-start font-bold">Supplier</th>
                  <th className="px-3 py-2 text-end font-bold">Orders</th>
                  <th className="px-3 py-2 text-end font-bold">Sales</th>
                  <th className="px-3 py-2 text-end font-bold">Share</th>
                  <th className="ps-3 py-2 text-end font-bold">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.top_suppliers.map((s) => (
                  <tr key={s.label}>
                    <td className="py-2.5 pe-3 font-bold text-neutral-900">{s.label}</td>
                    <td className="px-3 py-2.5 text-end text-neutral-700">{s.orders ?? 0}</td>
                    <td className="px-3 py-2.5 text-end font-semibold text-neutral-900">{money(Number(s.value))}</td>
                    <td className="px-3 py-2.5 text-end">
                      <span className="inline-flex items-center justify-end gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100">
                          <span className="block h-full rounded-full bg-blue-600" style={{ width: `${supplierTotal ? (Number(s.value) / supplierTotal) * 100 : 0}%` }} />
                        </span>
                        <span className="w-9 text-xs text-neutral-500">{supplierTotal ? Math.round((Number(s.value) / supplierTotal) * 100) : 0}%</span>
                      </span>
                    </td>
                    <td className="ps-3 py-2.5 text-end text-neutral-700">{s.label === "FasTrack" ? "—" : money(Number(s.commission ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
