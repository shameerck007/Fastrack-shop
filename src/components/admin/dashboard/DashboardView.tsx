import Link from "@/components/Link";
import { CountUp, Donut, Gauge, LedMeter, PerformanceChart, RadialBars, Columns, Ring, StackedBars, type NumKind } from "@/components/admin/dashboard/Viz";
import { OrderClock, SupplierBubbles } from "@/components/admin/dashboard/Infographics";
import { PALETTE } from "@/components/admin/dashboard/palette";
import { pctChange, type DashboardData } from "@/lib/admin-dashboard";

export const RANGES = [7, 30, 90] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8",
  confirmed: "#0ea5e9",
  preparing: "#6366f1",
  ready_for_pickup: "#d946ef",
  rider_assigned: "#f97316",
  out_for_delivery: "#f59e0b",
  delivered: "#10b981",
  cancelled: "#f43f5e",
};
const STATUS_ORDER = ["pending", "confirmed", "preparing", "ready_for_pickup", "rider_assigned", "out_for_delivery", "delivered", "cancelled"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

function Glass({ title, hint, children, className = "" }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {title && (
        <div className="mb-4">
          <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A see-through panel: the colour behind it shows through, like frosted glass. */
function Glassy({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/40 p-4 shadow-[0_8px_32px_rgba(99,102,241,0.14)] backdrop-blur-md sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-neutral-600">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Chip({ change, goodWhenDown = false }: { change: number | null; goodWhenDown?: boolean }) {
  if (change === null) return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">New</span>;
  if (change === 0) return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">steady</span>;
  const up = change > 0;
  const good = goodWhenDown ? !up : up;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{up ? "▲" : "▼"} {Math.abs(change)}%</span>;
}

function Tile({ icon, label, value, kind, decimals, change, goodWhenDown, color, pct }: { icon: string; label: string; value: number; kind: NumKind; decimals?: number; change: number | null; goodWhenDown?: boolean; color: string; pct: number }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white p-3.5 shadow-sm">
      <Ring pct={pct} color={color}>
        <span aria-hidden>{icon}</span>
      </Ring>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
        <CountUp value={value} kind={kind} decimals={decimals} className="block break-words font-mono text-lg font-extrabold leading-tight tabular-nums text-neutral-900 sm:text-xl" />
        <Chip change={change} goodWhenDown={goodWhenDown} />
      </div>
    </div>
  );
}

/** How full a ring is: half full means unchanged from the previous period, fuller means growth, emptier means a drop. */
const fill = (cur: number, prev: number) => (cur <= 0 ? 0 : prev <= 0 ? 100 : Math.min(100, Math.round((cur / (prev * 2)) * 100)));

export default function DashboardView({ data, days, money, t }: { data: DashboardData; days: number; money: (n: number) => string; t: (key: string) => string }) {
  const { cur, prev } = data;
  const aov = cur.orders ? cur.revenue / cur.orders : 0;
  const aovPrev = prev.orders ? prev.revenue / prev.orders : 0;
  const cancelRate = cur.placed ? (cur.cancelled / cur.placed) * 100 : 0;
  const cancelPrev = prev.placed ? (prev.cancelled / prev.placed) * 100 : 0;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const delivered = cur.placed - cur.cancelled > 0 ? (cur.delivered / (cur.placed - cur.cancelled)) * 100 : 0;
  const buyersTotal = data.buyers_split.returning + data.buyers_split.new;
  const loyalty = buyersTotal ? (data.buyers_split.returning / buyersTotal) * 100 : 0;
  const dTotal = Object.values(data.delivery_types).reduce((a, b) => a + b, 0);
  const express = dTotal ? ((data.delivery_types.express ?? 0) / dTotal) * 100 : 0;
  const ledMax = Math.max(cur.revenue, prev.revenue, 1) * 1.15;

  const att = data.attention;
  const alerts = [
    { n: att.pending_orders, label: "orders to confirm", href: "/admin/orders", c: "#f59e0b" },
    { n: att.awaiting_rider, label: "waiting for a rider", href: "/admin/orders", c: "#f97316" },
    { n: att.low_stock, label: "low stock", href: "/admin/products", c: "#f43f5e" },
    { n: att.pending_merchants, label: "supplier applications", href: "/admin/merchants", c: "#0ea5e9" },
    { n: att.pending_riders, label: "rider applications", href: "/admin/users", c: "#6366f1" },
  ].filter((a) => a.n > 0);

  const statusSlices = STATUS_ORDER.filter((s) => (data.status[s] ?? 0) > 0).map((s) => ({ label: t(`order_status.${s}`), value: data.status[s], color: STATUS_COLORS[s] }));
  const deliverySlices = [
    { label: "Express", value: data.delivery_types.express ?? 0, color: PALETTE[0] },
    { label: "Standard", value: data.delivery_types.standard ?? 0, color: PALETTE[1] },
    { label: "Scheduled", value: data.delivery_types.scheduled ?? 0, color: PALETTE[2] },
  ].filter((s) => s.value > 0);
  const customerSlices = [
    { label: "Returning customers", value: data.buyers_split.returning, color: PALETTE[6] },
    { label: "First-time customers", value: data.buyers_split.new, color: PALETTE[4] },
  ].filter((s) => s.value > 0);
  const sourceSlices = [
    { label: "Supplier shops", value: data.sales_source.suppliers ?? 0, color: PALETTE[1] },
    { label: "FasTrack's own stock", value: data.sales_source.fastrack ?? 0, color: PALETTE[3] },
  ].filter((s) => s.value > 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">Business overview</h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            {shortDate(data.start)} – {shortDate(data.today)} · compared with the {days} days before
          </p>
        </div>
        <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Period">
          {RANGES.map((r) => (
            <Link key={r} href={r === 30 ? "/admin" : `/admin?range=${r}`} role="tab" aria-selected={r === days} className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${r === days ? "bg-blue-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100"}`}>
              {r} days
            </Link>
          ))}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {alerts.map((a) => (
            <Link key={a.label} href={a.href} className="inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50" style={{ borderColor: `${a.c}66`, boxShadow: `0 2px 10px ${a.c}22` }}>
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: a.c, boxShadow: `0 0 10px ${a.c}` }} />
              <b className="text-neutral-900">{a.n}</b> {a.label}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-blue-600/25 sm:p-6 lg:col-span-5">
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-fuchsia-400/20 blur-2xl" />
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">Sales</p>
            <Chip change={pctChange(cur.revenue, prev.revenue)} />
          </div>
          <CountUp value={cur.revenue} kind="money" decimals={2} className="mt-2 block whitespace-nowrap font-mono font-extrabold tabular-nums text-white"  style={{ fontSize: "clamp(1.6rem, 3.4vw, 3rem)", textShadow: "0 0 26px rgba(255,255,255,0.35)" }} />
          <p className="mt-1 text-xs text-blue-100">
            {cur.orders} orders · {money(prev.revenue)} in the {days} days before
          </p>
          <div className="mt-6">
            <LedMeter value={cur.revenue} max={ledMax} mark={prev.revenue} />
            <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-blue-200">
              <span>0</span>
              <span>{money(Math.round(ledMax))}</span>
            </div>
          </div>
        </section>
        <Glass title="Operations health" hint="Live meters for the period" className="lg:col-span-7">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Gauge value={delivered} label="Delivered" caption={`${cur.delivered} of ${cur.placed - cur.cancelled} orders`} />
            <Gauge value={loyalty} label="Loyalty" caption="Customers who came back" colors={["#6366f1", "#d946ef", "#f97316"]} />
            <Gauge value={express} label="Express share" caption="Orders delivered fast" colors={["#06b6d4", "#0ea5e9", "#6366f1"]} />
          </div>
        </Glass>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon="🧾" label="Orders" value={cur.orders} kind="int" change={pctChange(cur.orders, prev.orders)} color={PALETTE[1]} pct={fill(cur.orders, prev.orders)} />
        <Tile icon="🧮" label="Average order" value={aov} kind="money" decimals={2} change={pctChange(aov, aovPrev)} color={PALETTE[0]} pct={fill(aov, aovPrev)} />
        <Tile icon="👥" label="Active customers" value={cur.buyers} kind="int" change={pctChange(cur.buyers, prev.buyers)} color={PALETTE[6]} pct={fill(cur.buyers, prev.buyers)} />
        <Tile icon="✨" label="New sign-ups" value={data.signups.cur} kind="int" change={pctChange(data.signups.cur, data.signups.prev)} color={PALETTE[2]} pct={fill(data.signups.cur, data.signups.prev)} />
        <Tile icon="💰" label="Commission" value={data.commission.cur} kind="money" decimals={2} change={pctChange(data.commission.cur, data.commission.prev)} color={PALETTE[5]} pct={fill(data.commission.cur, data.commission.prev)} />
        <Tile icon="🛵" label="Delivery fees" value={cur.delivery_fees} kind="money" decimals={2} change={pctChange(cur.delivery_fees, prev.delivery_fees)} color={PALETTE[7]} pct={fill(cur.delivery_fees, prev.delivery_fees)} />
        <Tile icon="🏷️" label="Discounts" value={cur.discounts} kind="money" decimals={2} change={pctChange(cur.discounts, prev.discounts)} goodWhenDown color={PALETTE[4]} pct={fill(cur.discounts, prev.discounts)} />
        <Tile icon="⛔" label="Cancellations" value={r1(cancelRate)} kind="pct" decimals={1} change={pctChange(r1(cancelRate), r1(cancelPrev))} goodWhenDown color={PALETTE[3]} pct={Math.min(100, Math.round(cancelRate))} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Glass title="Performance" hint="Sales every day, with the orders behind them" className="lg:col-span-8">
          <PerformanceChart series={data.series} previous={data.series_prev} />
        </Glass>
        <Glass title="Order status" hint="Everything placed in this period" className="lg:col-span-4">
          <Donut slices={statusSlices} centerLabel="orders" />
        </Glass>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Glass title="Categories" hint="Share of sales" className="lg:col-span-5">
          <RadialBars items={data.top_categories.map((c) => ({ label: c.label, value: Number(c.value) }))} format="money" />
        </Glass>
        <Glass title="Best-selling products" hint="Sales in this period" className="lg:col-span-7">
          <Columns items={data.top_products.map((p) => ({ label: p.label, value: Number(p.value) }))} format="money" />
        </Glass>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Glass title="Customers" hint="Who ordered">
          <Donut slices={customerSlices} centerLabel="customers" />
        </Glass>
        <Glass title="Delivery mix" hint="How orders travelled">
          <Donut slices={deliverySlices} centerLabel="orders" />
        </Glass>
        <Glass title="Where sales come from">
          <Donut slices={sourceSlices} centerLabel="sales" format="money" />
        </Glass>
      </div>

      <section className="relative mt-4 overflow-hidden rounded-[2rem] p-3 sm:p-5" style={{ background: "linear-gradient(135deg, #dbeafe 0%, #e0e7ff 38%, #fae8ff 72%, #ffedd5 100%)" }}>
        <span aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-sky-300/50 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-fuchsia-300/40 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute right-1/3 top-1/2 h-48 w-48 rounded-full bg-amber-200/50 blur-3xl" />
        <div className="relative grid gap-4">
          <Glassy title="When customers order" hint="Every hour of the day as a ray: longer is busier. Hover a ray for its hour.">
            <OrderClock cells={data.heat} />
          </Glassy>
          <Glassy title="Supplier performance" hint="Who sells the most, and how much FasTrack keeps from each">
            <SupplierBubbles items={data.top_suppliers.map((x) => ({ label: x.label, total: Number(x.value), part: Number(x.commission ?? 0), orders: Number(x.orders ?? 0) }))} />
          </Glassy>
        </div>
      </section>
    </div>
  );
}
