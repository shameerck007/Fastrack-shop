import Link from "@/components/Link";
import { PageHeader, StatGrid, StatTile } from "@/components/admin/AdminUi";
import { getMerchantStats, getMyStore } from "@/lib/merchant";
import { getMerchantOrders } from "@/lib/merchant-orders";
import { getStoreSettlementSummary } from "@/lib/settlements";
import StoreProfileForm from "@/components/merchant/StoreProfileForm";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { localizedName } from "@/lib/i18n/localized";
import { getMoney } from "@/lib/tenant-server";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  preparing: "bg-blue-50 text-blue-700",
  ready_for_pickup: "bg-blue-50 text-blue-700",
  rider_assigned: "bg-blue-50 text-blue-700",
  out_for_delivery: "bg-blue-50 text-blue-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
};

export default async function MerchantDashboardPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const store = await getMyStore();
  if (!store) return null;

  // Small, parallel queries only: counts, five recent orders and the balance. No product lists on the dashboard.
  const [money, stats, recent, summary] = await Promise.all([
    getMoney(),
    getMerchantStats(store.id),
    getMerchantOrders(5).catch(() => []),
    getStoreSettlementSummary(store.id).catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon="🏪"
        title={t("merchant.welcome_back", { name: store.name })}
        subtitle={t("merchant.storefront_intro")}
        actions={
          <>
            <Link href="/merchant/products" className="inline-flex h-10 items-center rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-blue-50">
              {t("merchant.manage_products")}
            </Link>
            <Link href="/merchant/catalog" className="inline-flex h-10 items-center rounded-full bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800">
              + Add from catalog
            </Link>
          </>
        }
      />

      {stats.newOrders > 0 && (
        <Link href="/merchant/orders" className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100">
          <span>
            🔔 {stats.newOrders} {t("merchant.new_orders").toLowerCase()}
          </span>
          <span aria-hidden className="rtl:-scale-x-100">→</span>
        </Link>
      )}

      <StatGrid>
        <StatTile icon="🧾" label={t("merchant.new_orders")} value={stats.newOrders} accent="#d97706" hint={`${stats.preparing} ${t("merchant.preparing_orders").toLowerCase()}`} />
        <StatTile icon="📦" label={t("merchant.products")} value={stats.products.toLocaleString()} accent="#2563eb" hint={`${stats.active.toLocaleString()} ${t("merchant.active").toLowerCase()}`} />
        <StatTile icon="⚠️" label={t("merchant.low_stock")} value={stats.lowStock} accent={stats.lowStock > 0 ? "#d97706" : "#64748b"} hint={stats.lowStock > 0 ? t("merchant.manage_products") : undefined} />
        <StatTile icon="📒" label={t("merchant.balance_due")} value={summary ? money(summary.balanceDue) : "—"} accent="#059669" hint={summary ? `${summary.deliveredOrderCount} ${t("merchant.delivered_th").toLowerCase()}` : undefined} />
      </StatGrid>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-800">Recent orders</h2>
          <Link href="/merchant/orders" className="text-xs font-semibold text-blue-700 hover:underline">
            {t("merchant.orders_nav")} →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="p-6 text-center text-sm text-neutral-400">{t("merchant.no_orders_yet_merchant")}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {recent.map((o) => {
              const names = o.order_items.map((i) => (i.product_variants?.products ? localizedName(i.product_variants.products, locale) : i.product_name));
              const total = o.order_items.reduce((sum, i) => sum + Number(i.line_total), 0);
              return (
                <li key={o.id}>
                  <Link href="/merchant/orders" className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900">{t("orders.order_hash", { number: o.order_number })}</p>
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
      </section>

      <StoreProfileForm
        initial={{
          logoUrl: store.logo_url ?? null,
          coverUrl: store.cover_url ?? null,
          tagline: store.tagline ?? null,
          hours: store.opening_hours ?? null,
          acceptingOrders: store.accepting_orders ?? true,
        }}
      />

      {store.status === "approved" && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="mb-1 text-sm font-medium">{t("merchant.store_qr_code")}</p>
          <p className="mb-3 text-xs text-neutral-500">{t("merchant.qr_intro")}</p>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/stores/${store.id}/qr`}
              alt={`QR code linking to ${store.name}'s storefront`}
              width={160}
              loading="lazy"
              height={160}
              className="rounded-lg border border-neutral-200"
            />
            <div className="flex flex-col gap-2 text-sm">
              <Link href={`/store/${store.id}`} className="text-blue-600 hover:underline">
                {t("merchant.view_public_storefront")}
              </Link>
              <a
                href={`/api/stores/${store.id}/qr`}
                download={`${store.name}-qr-code.png`}
                className="inline-flex w-fit items-center gap-1 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100"
              >
                {t("merchant.download_qr")}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm text-sm">
        <p className="mb-3 font-medium">{t("merchant.store_details")}</p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-400">{t("merchant.cr_number")}</dt>
            <dd className="text-neutral-700">{store.cr_number}</dd>
          </div>
          {store.vat_number && (
            <div>
              <dt className="text-xs text-neutral-400">{t("merchant.vat_number")}</dt>
              <dd className="text-neutral-700">{store.vat_number}</dd>
            </div>
          )}
          {store.contact_phone && (
            <div>
              <dt className="text-xs text-neutral-400">{t("merchant.contact_phone")}</dt>
              <dd className="text-neutral-700">{store.contact_phone}</dd>
            </div>
          )}
          {store.address_line && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-neutral-400">{t("merchant.pickup_address")}</dt>
              <dd className="text-neutral-700">
                {store.address_line}
                {store.city ? `, ${store.city}` : ""}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
