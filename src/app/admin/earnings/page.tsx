import Link from "@/components/Link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getMoney } from "@/lib/tenant-server";
import { pctChange, timeZoneFor } from "@/lib/admin-dashboard";
import { CountUp, Donut, Gauge, Ring, type NumKind } from "@/components/admin/dashboard/Viz";
import { CumulativeMargin, MarginWaterfall, SplitBar } from "@/components/admin/dashboard/EarningsViz";
import { AMBER, BRAND, EMERALD, ROSE, TEAL } from "@/components/admin/dashboard/palette";

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
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/** Today in the market's own calendar, as yyyy-mm-dd. */
const todayIn = (tz: string) => new Date().toLocaleDateString("en-CA", { timeZone: tz });
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000) + 1;
function periodFor(range: string, tz: string): { from: string; to: string } {
  const today = todayIn(tz);
  if (range === "last") {
    const to = addDays(`${today.slice(0, 8)}01`, -1);
    return { from: `${to.slice(0, 8)}01`, to };
  }
  if (range === "30") return { from: addDays(today, -29), to: today };
  if (range === "90") return { from: addDays(today, -89), to: today };
  return { from: `${today.slice(0, 8)}01`, to: today };
}

/** Everything the page shows, worked out once for a period so this period and the one before use the same rules. */
function figures(e: Earnings) {
  const deliveryNet = e.delivery_fees - e.delivery_fees_refunded;
  const margin = e.commission + deliveryNet - e.fastrack_discounts - e.rider_cost;
  const sales = e.own_sales + e.supplier_sales;
  const per = (n: number) => (e.orders > 0 ? n / e.orders : 0);
  return {
    deliveryNet,
    margin,
    sales,
    takeRate: e.supplier_sales > 0 ? (e.commission / e.supplier_sales) * 100 : 0,
    cover: e.rider_cost > 0 ? (deliveryNet / e.rider_cost) * 100 : deliveryNet > 0 ? 100 : 0,
    basket: per(e.gross_sales),
    marginPerOrder: per(margin),
    commissionPerOrder: per(e.commission),
    deliveryPerOrder: per(deliveryNet),
    riderPerOrder: per(e.rider_cost),
    discountPerOrder: per(e.fastrack_discounts),
  };
}

function Chip({ change, goodWhenDown = false }: { change: number | null; goodWhenDown?: boolean }) {
  if (change === null) return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">New</span>;
  if (change === 0) return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">steady</span>;
  const up = change > 0;
  const good = goodWhenDown ? !up : up;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {up ? "▲" : "▼"} {Math.abs(change)}%
    </span>
  );
}

/** How full a ring is: half full means unchanged from the period before, fuller means growth. */
const fill = (cur: number, prev: number) => (cur <= 0 ? 0 : prev <= 0 ? 100 : Math.min(100, Math.round((cur / (prev * 2)) * 100)));

function Tile({ icon, label, value, kind = "money", change, goodWhenDown, color, pct, hint }: { icon: string; label: string; value: number; kind?: NumKind; change: number | null; goodWhenDown?: boolean; color: string; pct: number; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-white/70 bg-white/55 p-3.5 shadow-[0_8px_32px_rgba(30,64,175,0.10)] backdrop-blur-md">
      <Ring pct={pct} color={color}>
        <span aria-hidden>{icon}</span>
      </Ring>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
        <CountUp value={value} kind={kind} decimals={kind === "pct" ? 1 : 0} className="block break-words font-mono text-lg font-extrabold leading-tight tabular-nums text-neutral-900 sm:text-xl" />
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Chip change={change} goodWhenDown={goodWhenDown} />
          {hint && <span className="text-[11px] text-neutral-500">{hint}</span>}
        </div>
      </div>
    </div>
  );
}

function Glassy({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-white/70 bg-white/45 p-4 shadow-[0_8px_32px_rgba(30,64,175,0.10)] backdrop-blur-md sm:p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-neutral-600">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Insight({ tone, children }: { tone: "good" | "warn" | "info"; children: React.ReactNode }) {
  const c = tone === "good" ? "bg-emerald-50/80 text-emerald-900 ring-emerald-200" : tone === "warn" ? "bg-amber-50/80 text-amber-900 ring-amber-200" : "bg-sky-50/80 text-sky-900 ring-sky-200";
  return (
    <li className={`flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm ring-1 ${c}`}>
      <span aria-hidden className="mt-0.5">
        {tone === "good" ? "✅" : tone === "warn" ? "⚠️" : "💡"}
      </span>
      <span>{children}</span>
    </li>
  );
}

export default async function AdminEarningsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.some((r) => r.id === sp.range) ? (sp.range as string) : "this";
  const [money, tenant] = await Promise.all([getMoney(), getCurrentTenant()]);
  const tz = timeZoneFor(tenant?.country_code);
  const { from, to } = periodFor(range, tz);
  const len = daysBetween(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(len - 1));

  const supabase = await createClient();
  const call = (f: string, t: string) => supabase.rpc("platform_earnings" as never, { p_from: f, p_to: t, p_tz: tz } as never);
  const [{ data, error }, { data: prevData }] = await Promise.all([call(from, to), call(prevFrom, prevTo)]);
  const cur = data as unknown as Earnings | null;
  const prev = (prevData as unknown as Earnings | null) ?? null;

  const header = (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">Platform earnings</h1>
        <p className="mt-0.5 text-xs text-neutral-500">
          What FasTrack really keeps · {short(from)} – {short(to)} · compared with {short(prevFrom)} – {short(prevTo)}
        </p>
      </div>
      <div className="inline-flex flex-wrap rounded-full border border-neutral-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Period">
        {RANGES.map((r) => (
          <Link key={r.id} href={r.id === "this" ? "/admin/earnings" : `/admin/earnings?range=${r.id}`} role="tab" aria-selected={r.id === range} className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${r.id === range ? "bg-blue-700 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100"}`}>
            {r.label}
          </Link>
        ))}
      </div>
    </div>
  );

  if (error || !cur) {
    return (
      <div>
        {header}
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          This report needs database migration <b>0092_refunds_statements_earnings.sql</b>. Run it in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  const f = figures(cur);
  const p = prev ? figures(prev) : null;
  const ch = (a: number, b: number | undefined) => pctChange(a, b ?? 0);
  const days = cur.series.map((d) => ({ date: d.date, margin: d.commission + d.delivery_fees - d.discounts - d.rider_cost }));
  const topSupplier = cur.top_suppliers.find((s) => s.commission > 0);
  const totalCommission = cur.top_suppliers.reduce((n, s) => n + Math.max(0, s.commission), 0);
  const revenue = cur.commission + f.deliveryNet;
  const costs = cur.fastrack_discounts + cur.rider_cost;
  const mixTotal = cur.own_sales + cur.supplier_sales;
  const bestDay = days.reduce((b, d) => (d.margin > b.margin ? d : b), days[0] ?? { date: to, margin: 0 });

  const insights: { tone: "good" | "warn" | "info"; text: React.ReactNode }[] = [];
  if (cur.orders === 0) insights.push({ tone: "info", text: "No delivered orders in this period yet, so there is nothing to measure. Try a longer period." });
  else {
    insights.push(f.margin >= 0 ? { tone: "good", text: <>Each delivered order leaves FasTrack <b>{money(f.marginPerOrder)}</b> after paying riders and funding discounts.</> } : { tone: "warn", text: <>Each delivered order currently <b>loses {money(Math.abs(f.marginPerOrder))}</b>. Rider pay and discounts are higher than commission and delivery fees.</> });
    if (cur.rider_cost > 0) insights.push(f.cover >= 100 ? { tone: "good", text: <>Delivery fees cover <b>{Math.round(f.cover)}%</b> of rider pay, so delivery pays for itself.</> } : { tone: "warn", text: <>Delivery fees cover only <b>{Math.round(f.cover)}%</b> of rider pay. FasTrack tops up {money(cur.rider_cost - f.deliveryNet)} to deliver. Consider raising the fee or the free-delivery threshold.</> });
    if (revenue > 0 && cur.fastrack_discounts / revenue > 0.25) insights.push({ tone: "warn", text: <>FasTrack-funded discounts used up <b>{Math.round((cur.fastrack_discounts / revenue) * 100)}%</b> of the money earned. Check which offers are paid by FasTrack rather than the supplier.</> });
    if (topSupplier && totalCommission > 0) insights.push({ tone: "info", text: <><b>{topSupplier.label}</b> brings <b>{Math.round((topSupplier.commission / totalCommission) * 100)}%</b> of commission. {topSupplier.commission / totalCommission > 0.5 ? "That is a lot of eggs in one basket." : "Income is spread across suppliers."}</> });
    if (cur.refunds > 0 && cur.gross_sales > 0) insights.push({ tone: cur.refunds / cur.gross_sales > 0.05 ? "warn" : "info", text: <>Refunds were <b>{(Math.round((cur.refunds / cur.gross_sales) * 1000) / 10).toFixed(1)}%</b> of sales ({money(cur.refunds)}).</> });
    if (p && p.margin !== 0) insights.push({ tone: f.margin >= p.margin ? "good" : "warn", text: <>Margin is {f.margin >= p.margin ? "up" : "down"} <b>{money(Math.abs(f.margin - p.margin))}</b> against the previous {len} days.</> });
  }

  return (
    <div>
      {header}

      <section className="relative overflow-hidden rounded-[2rem] p-3 sm:p-5" style={{ background: "linear-gradient(135deg, #e0f2fe 0%, #eef2ff 45%, #f1f5f9 100%)" }}>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl" />

        <div className="relative grid gap-4">
          {/* hero */}
          <Glassy title="Marketplace margin" hint="Commission and delivery fees, less the discounts FasTrack paid and what riders cost">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <CountUp value={f.margin} kind="money" className={`block break-words font-mono text-4xl font-extrabold tabular-nums sm:text-5xl ${f.margin >= 0 ? "text-emerald-600" : "text-rose-600"}`} />
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Chip change={ch(f.margin, p?.margin)} />
                  <span className="text-xs text-neutral-600">
                    from {cur.orders} delivered orders · {money(f.sales)} sold
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { k: "Earned", v: revenue, c: "text-blue-800" },
                  { k: "Spent", v: costs, c: "text-rose-700" },
                  { k: "Kept", v: f.margin, c: f.margin >= 0 ? "text-emerald-700" : "text-rose-700" },
                ].map((x) => (
                  <div key={x.k} className="rounded-2xl bg-white/60 px-3 py-2 ring-1 ring-white/80">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{x.k}</p>
                    <p className={`font-mono text-sm font-extrabold tabular-nums ${x.c}`}>{money(x.v)}</p>
                  </div>
                ))}
              </div>
            </div>
            <MarginWaterfall
              steps={[
                { label: "Commission", value: cur.commission, kind: "plus" },
                { label: "Delivery fees", value: f.deliveryNet, kind: "plus" },
                { label: "FasTrack discounts", value: cur.fastrack_discounts, kind: "minus" },
                { label: "Rider pay", value: cur.rider_cost, kind: "minus" },
                { label: "Margin", value: f.margin, kind: "total" },
              ]}
            />
          </Glassy>

          {/* tiles */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile icon="💰" label="Commission" value={cur.commission} change={ch(cur.commission, prev?.commission)} color={BRAND} pct={fill(cur.commission, prev?.commission ?? 0)} hint="from suppliers" />
            <Tile icon="🛵" label="Delivery fees kept" value={f.deliveryNet} change={ch(f.deliveryNet, p?.deliveryNet)} color={TEAL} pct={fill(f.deliveryNet, p?.deliveryNet ?? 0)} hint="from customers" />
            <Tile icon="🏷️" label="Discounts paid" value={cur.fastrack_discounts} change={ch(cur.fastrack_discounts, prev?.fastrack_discounts)} goodWhenDown color={AMBER} pct={fill(cur.fastrack_discounts, prev?.fastrack_discounts ?? 0)} hint="funded by FasTrack" />
            <Tile icon="🧑‍✈️" label="Rider cost" value={cur.rider_cost} change={ch(cur.rider_cost, prev?.rider_cost)} goodWhenDown color={ROSE} pct={fill(cur.rider_cost, prev?.rider_cost ?? 0)} hint="pay, salary, bonus" />
          </div>

          {/* gauges */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Glassy title="Take rate" hint="Commission as a share of what suppliers sell">
              <Gauge value={Math.min(100, f.takeRate * 4)} label={`${f.takeRate.toFixed(1)}% of supplier sales`} caption={p ? `previous ${p.takeRate.toFixed(1)}%` : undefined} colors={["#94a3b8", "#38bdf8", BRAND]} />
            </Glassy>
            <Glassy title="Delivery pays for itself?" hint="Delivery fees kept, against what riders cost">
              <Gauge value={Math.min(100, f.cover)} label={cur.rider_cost > 0 ? `${Math.round(f.cover)}% covered` : "No rider cost yet"} caption={cur.rider_cost > 0 ? (f.cover >= 100 ? "Delivery earns more than it costs" : `FasTrack tops up ${money(cur.rider_cost - f.deliveryNet)}`) : undefined} />
            </Glassy>
            <Glassy title="Margin per order" hint="What each delivered order leaves behind">
              <div className="flex h-full flex-col items-center justify-center gap-2 py-4">
                <CountUp value={f.marginPerOrder} kind="money" className={`font-mono text-4xl font-extrabold tabular-nums ${f.marginPerOrder >= 0 ? "text-emerald-600" : "text-rose-600"}`} />
                <Chip change={ch(f.marginPerOrder, p?.marginPerOrder)} />
                <p className="text-xs text-neutral-600">average basket {money(f.basket)}</p>
              </div>
            </Glassy>
          </div>

          {/* trend */}
          <Glassy title="Margin building up" hint="The line is the running total. The bars underneath are each day on its own. Move over it to read a day.">
            <CumulativeMargin days={days} />
            {days.length > 0 && cur.orders > 0 && (
              <p className="mt-2 text-xs text-neutral-600">
                Best day <b>{short(bestDay.date)}</b> with {money(bestDay.margin)}.
              </p>
            )}
          </Glassy>

          {/* where it comes from / goes */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Glassy title="Where the money comes from" hint="FasTrack's two income streams">
              <Donut
                format="money"
                centerLabel="earned"
                slices={[
                  { label: "Supplier commission", value: Math.max(0, cur.commission), color: BRAND },
                  { label: "Delivery fees", value: Math.max(0, f.deliveryNet), color: TEAL },
                ].filter((s) => s.value > 0)}
              />
            </Glassy>
            <Glassy title="Where it goes" hint="What FasTrack spends to earn it">
              <Donut
                format="money"
                centerLabel="spent"
                slices={[
                  { label: "Rider pay", value: cur.rider_cost, color: ROSE },
                  { label: "FasTrack discounts", value: cur.fastrack_discounts, color: AMBER },
                ].filter((s) => s.value > 0)}
              />
            </Glassy>
            <Glassy title="Who sells" hint="Supplier shops against FasTrack's own stock">
              <Donut
                format="money"
                centerLabel="sold"
                slices={[
                  { label: "Supplier shops", value: cur.supplier_sales, color: BRAND },
                  { label: "FasTrack's own stock", value: cur.own_sales, color: "#5eead4" },
                ].filter((s) => s.value > 0)}
              />
              {mixTotal > 0 && <p className="mt-3 text-center text-[11px] text-neutral-500">Own-stock sales are not counted as profit: purchase prices are not recorded.</p>}
            </Glassy>
          </div>

          {/* unit economics + suppliers */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Glassy title="Unit economics" hint="The average delivered order" className="lg:col-span-2">
              <dl className="grid gap-2 text-sm">
                {[
                  { k: "Average basket", v: f.basket, pv: p?.basket },
                  { k: "Commission", v: f.commissionPerOrder, pv: p?.commissionPerOrder },
                  { k: "Delivery fee kept", v: f.deliveryPerOrder, pv: p?.deliveryPerOrder },
                  { k: "Discounts paid", v: -f.discountPerOrder, pv: p ? -p.discountPerOrder : undefined },
                  { k: "Rider cost", v: -f.riderPerOrder, pv: p ? -p.riderPerOrder : undefined },
                ].map((r) => (
                  <div key={r.k} className="flex items-center justify-between gap-3 rounded-xl bg-white/55 px-3 py-2 ring-1 ring-white/80">
                    <dt className="text-neutral-600">{r.k}</dt>
                    <dd className="flex items-center gap-2 font-mono font-bold tabular-nums text-neutral-900">
                      {money(r.v)}
                      {r.pv !== undefined && r.pv !== 0 && <Chip change={pctChange(Math.abs(r.v), Math.abs(r.pv))} goodWhenDown={r.v < 0} />}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-700 px-3 py-2.5 text-white shadow">
                  <dt className="font-bold">Margin per order</dt>
                  <dd className="font-mono font-extrabold tabular-nums">{money(f.marginPerOrder)}</dd>
                </div>
              </dl>
              {cur.delivery_fees > 0 && cur.rider_cost > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-semibold text-neutral-600">Of every delivery fee, the rider takes</p>
                  <SplitBar left={Math.max(0, cur.delivery_fees - cur.rider_cost)} right={Math.min(cur.rider_cost, cur.delivery_fees)} leftLabel="FasTrack keeps" rightLabel="Rider cost" leftColor={EMERALD} rightColor={ROSE} />
                </div>
              )}
            </Glassy>
            <Glassy title="Commission by supplier" hint="Who earns FasTrack the most, after refunds" className="lg:col-span-3">
              {cur.top_suppliers.filter((s) => s.commission > 0).length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-500">No commission earned in this period.</p>
              ) : (
                <ol className="flex flex-col gap-3.5">
                  {cur.top_suppliers
                    .filter((s) => s.commission > 0)
                    .map((s, i) => {
                      const max = Math.max(...cur.top_suppliers.map((x) => x.commission), 1);
                      const rate = s.sales > 0 ? (s.commission / s.sales) * 100 : 0;
                      return (
                        <li key={s.label}>
                          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-center gap-2 font-semibold text-neutral-800">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-700 text-[10px] font-extrabold text-white">{i + 1}</span>
                              <span className="truncate">{s.label}</span>
                            </span>
                            <span className="shrink-0 font-mono font-bold tabular-nums text-neutral-900">{money(s.commission)}</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-white">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(4, (s.commission / max) * 100)}%`, background: "linear-gradient(90deg,#38bdf8,#1d4ed8)" }} />
                          </div>
                          <p className="mt-0.5 text-[11px] text-neutral-500">
                            {money(s.sales)} sold · {rate.toFixed(1)}% commission · {totalCommission > 0 ? Math.round((s.commission / totalCommission) * 100) : 0}% of all commission
                          </p>
                        </li>
                      );
                    })}
                </ol>
              )}
            </Glassy>
          </div>

          {/* insights */}
          <Glassy title="What this means" hint="Plain-language reading of the numbers above">
            <ul className="grid gap-2 md:grid-cols-2">
              {insights.map((i, n) => (
                <Insight key={n} tone={i.tone}>
                  {i.text}
                </Insight>
              ))}
            </ul>
          </Glassy>

          <p className="px-1 text-[11px] leading-relaxed text-neutral-500">
            Counted on delivered orders in this market, by the day they were delivered. Left out: the cost of goods FasTrack sells from its own stock (purchase prices are not recorded), payment fees, and tax owed on FasTrack&apos;s own income. Tax inside sales: {money(cur.tax_inside)}. Refunds: {money(cur.refunds)}.
          </p>
        </div>
      </section>
    </div>
  );
}
