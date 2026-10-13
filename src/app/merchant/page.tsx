import Link from "@/components/Link";
import { getMerchantStats, getMyStore } from "@/lib/merchant";
import { getMerchantOrders } from "@/lib/merchant-orders";
import { getStoreSettlementSummary } from "@/lib/settlements";
import { deltaPercent, getLowStockItems, getReturnsWaiting, getSalesOverview, type DayPoint } from "@/lib/merchant-dashboard";
import StoreProfileForm from "@/components/merchant/StoreProfileForm";
import DashSalesChart from "@/components/merchant/DashSalesChart";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { localizedName } from "@/lib/i18n/localized";
import { getCurrentTenant, getMoney } from "@/lib/tenant-server";
import { timeZoneFor } from "@/lib/admin-dashboard";
import { dayPart, hello, localClock, PART_ICON, quoteFor } from "@/lib/greeting";
import { BRAND } from "@/lib/brand";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-brand-50 text-brand-700",
  preparing: "bg-brand-50 text-brand-700",
  ready_for_pickup: "bg-brand-50 text-brand-700",
  rider_assigned: "bg-brand-50 text-brand-700",
  out_for_delivery: "bg-brand-50 text-brand-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
};

const card = "rounded-2xl border border-neutral-200 bg-white shadow-sm";
const btnGhost = "inline-flex h-10 items-center rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50";

function Sparkline({ days }: { days: DayPoint[] }) {
  const max = Math.max(1, ...days.map((d) => d.sales));
  const pts = days.map((d, i) => `${(i / Math.max(1, days.length - 1)) * 100},${28 - (d.sales / max) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  const d = deltaPercent(now, before);
  if (d === null) return <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">New</span>;
  if (d === 0) return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">No change</span>;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d)}%
    </span>
  );
}

function Kpi({ label, value, hint, accent, extra, href }: { label: string; value: string; hint?: React.ReactNode; accent: string; extra?: React.ReactNode; href?: string }) {
  const body = (
    <div className={`${card} h-full p-4 transition ${href ? "hover:border-neutral-300 hover:shadow-md" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
      </div>
      <p className="mt-2 break-words text-2xl font-extrabold leading-tight tracking-tight text-neutral-900">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">{hint}</div>
      {extra && <div className="mt-2" style={{ color: accent }}>{extra}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function Section({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${card} overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const linkSm = "inline-flex h-9 items-center text-xs font-semibold text-brand-700 hover:underline";

export default async function MerchantDashboardPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const store = await getMyStore();
  if (!store) return null;

  const [money, stats, recent, summary, sales, low, returnsWaiting] = await Promise.all([
    getMoney(),
    getMerchantStats(store.id),
    getMerchantOrders(6).catch(() => []),
    getStoreSettlementSummary(store.id).catch(() => null),
    getSalesOverview(store.id).catch(() => null),
    getLowStockItems(store.id, 5).catch(() => ({ items: [], total: 0 })),
    getReturnsWaiting(store.id).catch(() => 0),
  ]);

  const tenant = await getCurrentTenant().catch(() => null);
  const clock = localClock(timeZoneFor(tenant?.country_code));
  const part = dayPart(clock.hour);
  const today = sales?.days[sales.days.length - 1];
  const openOrders = stats.newOrders + stats.preparing + stats.ready;
  const accepting = store.accepting_orders ?? true;
  const attention: { href: string; tone: "amber" | "red" | "blue"; icon: string; text: string }[] = [];
  if (!accepting) attention.push({ href: "#your-store", tone: "red", icon: "⏸️", text: "Your store is paused: customers cannot order from you right now" });
  if (stats.newOrders > 0) attention.push({ href: "/merchant/orders", tone: "amber", icon: "🔔", text: `${stats.newOrders} new order${stats.newOrders === 1 ? "" : "s"} to confirm` });
  if (returnsWaiting > 0) attention.push({ href: "/merchant/returns", tone: "blue", icon: "↩️", text: `${returnsWaiting} return${returnsWaiting === 1 ? "" : "s"} waiting to be checked in` });
  if (low.total > 0) attention.push({ href: "/merchant/products", tone: "amber", icon: "⚠️", text: `${low.total} item${low.total === 1 ? "" : "s"} running low on stock` });
  const tone = { amber: "border-amber-200 bg-amber-50 text-amber-900", red: "border-red-200 bg-red-50 text-red-900", blue: "border-brand-200 bg-brand-50 text-brand-900" };

  const topMax = Math.max(1, ...(sales?.top.map((p) => p.revenue) ?? [1]));

  return (
    <div className="flex flex-col gap-5">
      {/* welcome */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-3xl ring-1 ring-amber-100" aria-hidden>
              {PART_ICON[part]}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-500">{hello(part, locale)},</p>
              <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-neutral-900">{store.name}</h1>
              <p className="mt-0.5 text-xs text-neutral-500">
                {clock.weekday}, {clock.dateLine}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-white px-3 py-1.5 text-neutral-700 ring-1 ring-neutral-200">
              Today: <b className="text-neutral-900">{today ? today.orders : 0}</b> order{today?.orders === 1 ? "" : "s"} · <b className="text-neutral-900">{money(today?.sales ?? 0)}</b>
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-neutral-700 ring-1 ring-neutral-200">
              <b className="text-neutral-900">{openOrders}</b> open now
            </span>
            <span className={`rounded-full px-3 py-1.5 ${accepting ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{accepting ? "● Accepting orders" : "● Paused"}</span>
          </div>
        </div>
        <blockquote className="border-s-4 border-brand-200 ps-4 text-sm italic leading-relaxed text-neutral-600">“{quoteFor(part, clock.dayOfYear, locale)}”</blockquote>
      </section>

      {/* needs attention: only shown when something needs action */}
      {attention.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {attention.map((a) => (
            <Link key={a.text} href={a.href} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold leading-snug transition hover:shadow-md ${tone[a.tone]}`}>
              <span className="text-lg" aria-hidden>{a.icon}</span>
              <span className="min-w-0 flex-1">{a.text}</span>
              <span aria-hidden className="rtl:-scale-x-100">→</span>
            </Link>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 lg:grid-cols-4">
        <Kpi
          label="Sales · 30 days"
          value={sales ? money(sales.sales30) : "—"}
          accent={BRAND[600]}
          hint={sales ? <><Delta now={sales.sales30} before={sales.salesPrev30} /> <span>vs the 30 days before</span></> : undefined}
          extra={sales ? <Sparkline days={sales.days} /> : undefined}
        />
        <Kpi
          label="Orders · 30 days"
          value={sales ? sales.orders30.toLocaleString() : "—"}
          accent="#7c3aed"
          hint={sales ? <><Delta now={sales.orders30} before={sales.ordersPrev30} /> <span>{stats.newOrders + stats.preparing + stats.ready} open now</span></> : undefined}
          href="/merchant/orders"
        />
        <Kpi
          label={t("merchant.balance_due")}
          value={summary ? money(summary.balanceDue) : "—"}
          accent={summary && summary.balanceDue > 0.005 ? "#d97706" : "#059669"}
          hint={summary ? <span>{summary.deliveredOrderCount} delivered · open the Supplier ledger →</span> : undefined}
          href="/merchant/settlements"
        />
        <Kpi
          label={t("merchant.products")}
          value={`${stats.active.toLocaleString()} / ${stats.products.toLocaleString()}`}
          accent="#059669"
          hint={<span>{stats.active.toLocaleString()} active{low.total > 0 ? ` · ${low.total} low` : ""}</span>}
          href="/merchant/products"
        />
      </div>

      {/* sales + top products */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Sales" className="lg:col-span-2">
          <div className="p-4">{sales ? <DashSalesChart days={sales.days} /> : <p className="py-8 text-center text-sm text-neutral-500">Sales will appear here once customers order.</p>}</div>
        </Section>
        <Section title="Top products · 30 days">
          {!sales || sales.top.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-500">No sales in the last 30 days yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {sales.top.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-4 shrink-0 text-center text-xs font-bold text-neutral-500">{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-neutral-50 object-contain" /> : <span className="h-10 w-10 shrink-0 rounded-lg bg-neutral-100" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{p.name}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max(6, (p.revenue / topMax) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-neutral-900">{money(p.revenue)}</p>
                    <p className="text-[11px] text-neutral-500">{p.units} sold</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* recent orders + low stock */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Recent orders" className="lg:col-span-2" action={<Link href="/merchant/orders" className={linkSm}>All orders →</Link>}>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <span className="text-3xl" aria-hidden>🧾</span>
              <p className="text-sm text-neutral-500">{t("merchant.no_orders_yet_merchant")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {recent.map((o) => {
                const names = o.order_items.map((i) => (i.product_variants?.products ? localizedName(i.product_variants.products, locale) : i.product_name));
                const total = o.order_items.reduce((sum, i) => sum + Number(i.line_total), 0);
                return (
                  <li key={o.id}>
                    <Link href="/merchant/orders" className="flex items-center gap-3 px-4 py-3 transition hover:bg-neutral-50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-900">
                          {t("orders.order_hash", { number: o.order_number })}
                          <span className="ms-2 whitespace-nowrap text-xs font-normal text-neutral-500">{new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                        </p>
                        <p className="truncate text-xs text-neutral-500">{names.join(locale === "ar" ? "، " : ", ")}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-neutral-700">{money(total)}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[o.status] ?? "bg-neutral-100 text-neutral-600"}`}>{t(`order_status.${o.status}`)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Running low" action={low.total > 0 ? <Link href="/merchant/products" className={linkSm}>Restock →</Link> : undefined}>
          {low.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <span className="text-3xl" aria-hidden>📦</span>
              <p className="text-sm text-neutral-500">Every product is above its minimum stock.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {low.items.map((it, i) => (
                <li key={`${it.productId}-${i}`}>
                  <Link href={`/merchant/products?q=${encodeURIComponent(it.name)}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-neutral-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.imageUrl ? <img src={it.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-neutral-50 object-contain" /> : <span className="h-10 w-10 shrink-0 rounded-lg bg-neutral-100" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{it.name}</p>
                      <p className="truncate text-[11px] text-neutral-500">{it.label}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                        <div className={`h-full rounded-full ${it.stock <= 0 ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${Math.max(4, Math.min(100, (it.stock / Math.max(1, it.minStock)) * 100))}%` }} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-bold ${it.stock <= 0 ? "text-red-600" : "text-amber-700"}`}>{it.stock <= 0 ? "Out" : it.stock}</p>
                      <p className="text-[11px] text-neutral-500">min {it.minStock}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* your store */}
      <div id="your-store" className="scroll-mt-20">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Your store</h2>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <StoreProfileForm
              initial={{
                logoUrl: store.logo_url ?? null,
                coverUrl: store.cover_url ?? null,
                tagline: store.tagline ?? null,
                hours: store.opening_hours ?? null,
                acceptingOrders: store.accepting_orders ?? true,
              }}
            />
          </div>
          <div className="flex flex-col gap-5">
            {store.status === "approved" && (
              <section className={`${card} p-4`}>
                <p className="text-sm font-semibold text-neutral-800">{t("merchant.store_qr_code")}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{t("merchant.qr_intro")}</p>
                <div className="mt-3 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/stores/${store.id}/qr`} alt={`QR code linking to ${store.name}'s storefront`} width={112} height={112} loading="lazy" className="h-28 w-28 shrink-0 rounded-lg border border-neutral-200" />
                  <div className="flex min-w-0 flex-col items-start gap-2">
                    <Link href={`/store/${store.id}`} className={btnGhost}>
                      {t("merchant.view_public_storefront")}
                    </Link>
                    <a href={`/api/stores/${store.id}/qr`} download={`${store.name}-qr-code.png`} className="inline-flex h-10 items-center rounded-full px-1 text-sm font-semibold text-brand-700 hover:underline">
                      ⬇ {t("merchant.download_qr")}
                    </a>
                  </div>
                </div>
              </section>
            )}
            <section className={`${card} p-4 text-sm`}>
              <p className="mb-3 font-semibold text-neutral-800">{t("merchant.store_details")}</p>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3">
                <div>
                  <dt className="text-xs text-neutral-500">{t("merchant.cr_number")}</dt>
                  <dd className="text-neutral-700">{store.cr_number}</dd>
                </div>
                {store.vat_number && (
                  <div>
                    <dt className="text-xs text-neutral-500">{t("merchant.vat_number")}</dt>
                    <dd className="text-neutral-700">{store.vat_number}</dd>
                  </div>
                )}
                {store.contact_phone && (
                  <div>
                    <dt className="text-xs text-neutral-500">{t("merchant.contact_phone")}</dt>
                    <dd className="text-neutral-700">{store.contact_phone}</dd>
                  </div>
                )}
                {store.address_line && (
                  <div>
                    <dt className="text-xs text-neutral-500">{t("merchant.pickup_address")}</dt>
                    <dd className="text-neutral-700">
                      {store.address_line}
                      {store.city ? `, ${store.city}` : ""}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
