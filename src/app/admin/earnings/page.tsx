import Link from "@/components/Link";
import { PageHeader } from "@/components/admin/AdminUi";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getMoney } from "@/lib/tenant-server";
import { timeZoneFor } from "@/lib/admin-dashboard";

export const metadata = { title: "Platform earnings" };

interface Earnings {
  from: string;
  to: string;
  orders: number;
  gross_sales: number;
  refunds: number;
  tax_inside: number;
  own_sales: number;
  supplier_sales: number;
  commission: number;
  delivery_fees: number;
  delivery_fees_refunded: number;
  fastrack_discounts: number;
  rider_cost: number;
  series: { date: string; commission: number; delivery_fees: number; discounts: number; rider_cost: number }[];
  top_suppliers: { label: string; sales: number; commission: number }[];
}

const RANGES = [
  { id: "this", label: "This month" },
  { id: "last", label: "Last month" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
] as const;

/** Today in the market's own calendar, as yyyy-mm-dd. */
function todayIn(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function periodFor(range: string, tz: string): { from: string; to: string } {
  const today = todayIn(tz);
  if (range === "last") {
    const first = `${today.slice(0, 8)}01`;
    const to = addDays(first, -1);
    return { from: `${to.slice(0, 8)}01`, to };
  }
  if (range === "30") return { from: addDays(today, -29), to: today };
  if (range === "90") return { from: addDays(today, -89), to: today };
  return { from: `${today.slice(0, 8)}01`, to: today };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

function Tile({ label, value, hint, tone = "text-neutral-900" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

/** From revenue streams to margin: each bar starts where the last one ended. */
function Waterfall({ steps, money }: { steps: { label: string; value: number; kind: "plus" | "minus" | "total" }[]; money: (n: number) => string }) {
  const W = 720;
  const H = 260;
  const padL = 12;
  const padB = 44;
  const padT = 26;
  const bars = steps.reduce<((typeof steps)[number] & { lo: number; hi: number; end: number })[]>((acc, s) => {
    const run = acc.length ? acc[acc.length - 1].end : 0;
    const start = s.kind === "total" ? 0 : run;
    const end = s.kind === "total" ? s.value : s.kind === "plus" ? run + s.value : run - s.value;
    acc.push({ ...s, lo: Math.min(start, end), hi: Math.max(start, end), end });
    return acc;
  }, []);
  const top = Math.max(...bars.map((b) => b.hi), 1);
  const bottom = Math.min(...bars.map((b) => b.lo), 0);
  const y = (v: number) => padT + ((top - v) / (top - bottom || 1)) * (H - padT - padB);
  const bw = (W - padL * 2) / bars.length;
  const color = (b: (typeof bars)[number]) => (b.kind === "total" ? (b.value >= 0 ? "#059669" : "#e11d48") : b.kind === "plus" ? (b.label === "Commission" ? "#1d4ed8" : "#0d9488") : b.label === "Rider pay" ? "#e11d48" : "#f59e0b");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="From commission and delivery fees to the marketplace margin">
      <line x1={padL} x2={W - padL} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth="1" />
      {bars.map((b, i) => {
        const x = padL + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const h = Math.max(2, y(b.lo) - y(b.hi));
        return (
          <g key={b.label}>
            <rect x={x} y={y(b.hi)} width={w} height={h} rx="8" fill={color(b)} opacity={b.kind === "total" ? 1 : 0.92} />
            {i < bars.length - 1 && <line x1={x + w} x2={x + bw * 0.36 + w} y1={y(b.end)} y2={y(b.end)} stroke="#94a3b8" strokeDasharray="3 3" />}
            <text x={x + w / 2} y={y(b.hi) - 7} textAnchor="middle" fontSize="12" fontWeight="800" fill="#0f172a">
              {b.kind === "minus" ? "−" : b.kind === "plus" ? "+" : ""}
              {money(Math.abs(b.value))}
            </text>
            <text x={x + w / 2} y={H - 18} textAnchor="middle" fontSize="12" fontWeight="600" fill="#475569">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DailyMargin({ series }: { series: Earnings["series"] }) {
  const W = 720;
  const H = 150;
  const pad = 8;
  const vals = series.map((d) => d.commission + d.delivery_fees - d.discounts - d.rider_cost);
  const top = Math.max(...vals, 1);
  const low = Math.min(...vals, 0);
  const y = (v: number) => pad + ((top - v) / (top - low || 1)) * (H - pad * 2 - 16);
  const bw = (W - pad * 2) / Math.max(series.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Margin for each day">
      <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="#cbd5e1" />
      {vals.map((v, i) => (
        <rect key={series[i].date} x={pad + i * bw + bw * 0.15} y={v >= 0 ? y(v) : y(0)} width={bw * 0.7} height={Math.max(1.5, Math.abs(y(v) - y(0)))} rx="3" fill={v >= 0 ? "#2563eb" : "#e11d48"} opacity="0.9">
          <title>{`${short(series[i].date)}: ${v.toFixed(2)}`}</title>
        </rect>
      ))}
      <text x={pad} y={H - 2} fontSize="10" fill="#64748b">
        {short(series[0]?.date ?? "")}
      </text>
      <text x={W - pad} y={H - 2} textAnchor="end" fontSize="10" fill="#64748b">
        {short(series[series.length - 1]?.date ?? "")}
      </text>
    </svg>
  );
}

export default async function AdminEarningsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.some((r) => r.id === sp.range) ? (sp.range as string) : "this";
  const [money, tenant] = await Promise.all([getMoney(), getCurrentTenant()]);
  const tz = timeZoneFor(tenant?.country_code);
  const { from, to } = periodFor(range, tz);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_earnings" as never, { p_from: from, p_to: to, p_tz: tz } as never);
  const e = data as unknown as Earnings | null;

  const header = (
    <PageHeader
      icon="📈"
      title="Platform earnings"
      subtitle={`What FasTrack really earns on delivered orders, ${short(from)} to ${short(to)}.`}
      actions={
        <div className="inline-flex flex-wrap rounded-full border border-neutral-200 bg-white p-0.5 shadow-sm" role="tablist" aria-label="Period">
          {RANGES.map((r) => (
            <Link key={r.id} href={r.id === "this" ? "/admin/earnings" : `/admin/earnings?range=${r.id}`} role="tab" aria-selected={r.id === range} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${r.id === range ? "bg-blue-700 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
              {r.label}
            </Link>
          ))}
        </div>
      }
    />
  );

  if (error || !e) {
    return (
      <div>
        {header}
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          This report needs database migration <b>0092_refunds_statements_earnings.sql</b>. Run it in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  const margin = e.commission + e.delivery_fees - e.delivery_fees_refunded - e.fastrack_discounts - e.rider_cost;
  const deliveryNet = e.delivery_fees - e.delivery_fees_refunded;
  const supplierShare = e.supplier_sales + e.own_sales > 0 ? Math.round((e.supplier_sales / (e.supplier_sales + e.own_sales)) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {header}

      <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">Marketplace margin</p>
            <p className={`text-4xl font-extrabold tracking-tight sm:text-5xl ${margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{money(margin)}</p>
            <p className="mt-0.5 text-xs text-neutral-500">Commission and delivery fees, less the discounts FasTrack paid and what riders cost.</p>
          </div>
          <p className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{e.orders} delivered orders</p>
        </div>
        <Waterfall
          money={money}
          steps={[
            { label: "Commission", value: e.commission, kind: "plus" },
            { label: "Delivery fees", value: deliveryNet, kind: "plus" },
            { label: "FasTrack discounts", value: e.fastrack_discounts, kind: "minus" },
            { label: "Rider pay", value: e.rider_cost, kind: "minus" },
            { label: "Margin", value: margin, kind: "total" },
          ]}
        />
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Gross sales" value={money(e.gross_sales)} hint="Delivered orders, tax included" />
        <Tile label="Refunds" value={e.refunds > 0 ? `-${money(e.refunds)}` : money(0)} hint="Returned to customers" tone={e.refunds > 0 ? "text-amber-600" : undefined} />
        <Tile label="Tax inside sales" value={money(e.tax_inside)} hint="VAT / GST in the prices, after refunds" />
        <Tile label="Sold by suppliers" value={`${supplierShare}%`} hint={`${money(e.supplier_sales)} suppliers · ${money(e.own_sales)} FasTrack stock`} tone="text-blue-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-3">
          <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">Margin each day</h2>
          <p className="mb-3 text-xs text-neutral-500">Blue is a day that earned, red is a day the costs were higher.</p>
          <DailyMargin series={e.series} />
        </section>
        <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
          <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">Commission by supplier</h2>
          <p className="mb-3 text-xs text-neutral-500">After refunds.</p>
          {e.top_suppliers.filter((s) => s.commission > 0).length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">No commission earned in this period.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {e.top_suppliers
                .filter((s) => s.commission > 0)
                .map((s) => {
                  const max = Math.max(...e.top_suppliers.map((x) => x.commission), 1);
                  return (
                    <li key={s.label}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-semibold text-neutral-800">{s.label}</span>
                        <span className="shrink-0 font-bold text-neutral-900">{money(s.commission)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, (s.commission / max) * 100)}%` }} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-neutral-400">{money(s.sales)} sold</p>
                    </li>
                  );
                })}
            </ol>
          )}
        </section>
      </div>

      <p className="rounded-2xl bg-neutral-100/70 px-4 py-3 text-xs text-neutral-500">
        What this leaves out: the cost of the goods FasTrack sells from its own stock (purchase prices are not recorded, so own-stock sales of {money(e.own_sales)} are not counted as profit), payment fees (cash on delivery has none), and tax FasTrack owes on its own commission and delivery income. Peak daily commission and delivery are shown in the chart above.
      </p>
    </div>
  );
}
