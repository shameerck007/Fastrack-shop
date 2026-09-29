import Link from "next/link";
import { getFastrackStoreAnalytics } from "@/lib/fastrack-store";
import { formatSAR } from "@/lib/utils";
import RevenueTrendChart from "@/components/admin/charts/RevenueTrendChart";
import BarList from "@/components/admin/charts/BarList";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  confirmed: "bg-blue-50 text-blue-700",
  preparing: "bg-blue-50 text-blue-700",
  ready_for_pickup: "bg-amber-50 text-amber-700",
  rider_assigned: "bg-amber-50 text-amber-700",
  out_for_delivery: "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

const STATUS_BAR_COLORS: Record<string, string> = {
  pending: "#bfdbfe",
  confirmed: "#93c5fd",
  preparing: "#60a5fa",
  ready_for_pickup: "#3b82f6",
  rider_assigned: "#2563eb",
  out_for_delivery: "#1d4ed8",
  delivered: "#059669",
  cancelled: "#dc2626",
};

const STATUS_ORDER = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "rider_assigned",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

function Stat({ icon, label, value, accent, href }: { icon: string; label: string; value: string | number; accent: string; href?: string }) {
  const content = (
    <div className="flex items-center gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ background: `${accent}1a`, color: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p className="truncate text-2xl font-semibold leading-tight text-neutral-900">{value}</p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      {content}
    </Link>
  ) : (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">{content}</div>
  );
}

export default async function AdminFastrackStorePage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const analytics = await getFastrackStoreAnalytics();

  const orderedStatusCounts = STATUS_ORDER.map((status) => ({
    status,
    count: analytics.statusCounts.find((s) => s.status === status)?.count ?? 0,
  })).filter((s) => s.count > 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">
            🏬
          </span>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{t("admin.fastrack_stores_title")}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">{t("admin.fastrack_stores_subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon="📈" label={t("admin.revenue_30d")} value={formatSAR(analytics.revenue30d)} accent="#059669" />
        <Stat icon="🧾" label={t("admin.orders_30d")} value={analytics.orders30d} accent="#2563eb" />
        <Stat icon="🧮" label={t("admin.avg_order_value")} value={formatSAR(analytics.avgOrderValue30d)} accent="#7c3aed" />
        <Stat icon="📦" label={t("admin.products")} value={analytics.totalProducts} accent="#2563eb" href="/admin/products" />
        <Stat
          icon="⚠️"
          label={t("admin.low_stock_items")}
          value={analytics.lowStockCount}
          accent={analytics.lowStockCount > 0 ? "#dc2626" : "#a3a3a3"}
          href="/admin/products"
        />
      </div>

      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-medium">{t("admin.revenue_trend")}</p>
          <span className="text-xs text-neutral-400">{t("admin.last_14_days")}</span>
        </div>
        <RevenueTrendChart data={analytics.dailyRevenue} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium">{t("admin.orders_by_status_30d")}</p>
          <BarList
            items={orderedStatusCounts.map((s) => ({
              label: t(`order_status.${s.status}`) ?? s.status,
              value: s.count,
              color: STATUS_BAR_COLORS[s.status],
            }))}
            formatValue={(v) => String(v)}
          />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium">{t("admin.top_products_30d")}</p>
          <BarList items={analytics.topProducts} formatValue={formatSAR} emptyLabel={t("admin.no_sales_30d")} />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium">{t("admin.revenue_by_category_30d")}</p>
          <BarList items={analytics.topCategories} formatValue={formatSAR} emptyLabel={t("admin.no_sales_30d")} />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">{t("admin.recent_orders")}</p>
          <Link href="/admin/orders" className="text-xs text-blue-600 hover:underline">
            {t("admin.view_all")}
          </Link>
        </div>
        {analytics.recentOrders.length === 0 ? (
          <p className="text-sm text-neutral-400">{t("admin.no_orders_yet")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-neutral-100">
            {analytics.recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-neutral-50"
              >
                <div>
                  <p className="font-medium">#{order.order_number}</p>
                  <p className="text-xs text-neutral-400">
                    {new Date(order.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-700">{formatSAR(order.ownSubtotal)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[order.status] ?? "bg-neutral-100 text-neutral-600"}`}
                  >
                    {t(`order_status.${order.status}`)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
