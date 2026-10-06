import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { getFastrackStoreAnalytics } from "@/lib/fastrack-store";

import RevenueTrendChart from "@/components/admin/charts/RevenueTrendChart";
import BarList from "@/components/admin/charts/BarList";
import FastrackStoreStatusToggle from "@/components/admin/FastrackStoreStatusToggle";
import AddWarehouseStaffForm from "@/components/admin/AddWarehouseStaffForm";
import RemoveWarehouseStaffButton from "@/components/admin/RemoveWarehouseStaffButton";
import { getWarehouseStaffList } from "@/lib/actions/admin-warehouse-staff";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getMoney } from "@/lib/tenant-server";

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

function Stat({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
      <p className={`text-2xl font-semibold`} style={{ color: accent }}>
        {icon} {value}
      </p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

export default async function AdminFastrackStoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const money = await getMoney();
  const { id } = await params;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const analytics = await getFastrackStoreAnalytics(id);

  if (!analytics.warehouse) notFound();
  const w = analytics.warehouse;
  const staff = await getWarehouseStaffList(w.id);

  const orderedStatusCounts = STATUS_ORDER.map((status) => ({
    status,
    count: analytics.statusCounts.find((s) => s.status === status)?.count ?? 0,
  })).filter((s) => s.count > 0);

  return (
    <div>
      <Link href="/admin/store" className="text-sm text-blue-600 hover:underline">
        {t("fastrack_stores.all_stores")}
      </Link>

      <div className="mb-4 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{w.name}</h1>
            {w.is_default && (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {t("fastrack_stores.default_badge")}
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                w.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {w.is_active ? t("fastrack_stores.active") : t("fastrack_stores.inactive")}
            </span>
          </div>
          <p className="text-sm text-neutral-500">{w.address_line ?? t("fastrack_stores.no_address")}</p>
          <Link href="/admin/zones" className="mt-1 inline-block text-xs text-blue-600 hover:underline">
            {t("fastrack_stores.set_delivery_boundary")}
          </Link>
        </div>
        <FastrackStoreStatusToggle warehouseId={w.id} isActive={w.is_active} />
      </div>

      {w.is_default && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          {t("fastrack_stores.default_note")}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat icon="📈" label={t("admin.revenue_30d")} value={money(analytics.revenue30d)} accent="#059669" />
        <Stat icon="🧾" label={t("admin.orders_30d")} value={analytics.orders30d} accent="#2563eb" />
        <Stat icon="⚠️" label={t("admin.low_stock_items")} value={analytics.lowStockCount} accent={analytics.lowStockCount > 0 ? "#dc2626" : "#a3a3a3"} />
      </div>

      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-medium">{t("admin.revenue_trend")}</p>
          <span className="text-xs text-neutral-400">{t("admin.last_14_days")}</span>
        </div>
        <RevenueTrendChart data={analytics.dailyRevenue} money={money} />
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
          <BarList items={analytics.topProducts} formatValue={money} emptyLabel={t("admin.no_sales_30d")} />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium">{t("admin.revenue_by_category_30d")}</p>
          <BarList items={analytics.topCategories} formatValue={money} emptyLabel={t("admin.no_sales_30d")} />
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t("warehouse_staff.section_title")}</p>
            <p className="text-xs text-neutral-400">{t("warehouse_staff.section_intro")}</p>
          </div>
          <AddWarehouseStaffForm warehouseId={w.id} />
        </div>
        {staff.length === 0 ? (
          <p className="text-sm text-neutral-400">{t("warehouse_staff.no_staff_yet")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-neutral-100">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-neutral-700">{s.fullName ?? t("add_rider.unnamed_account")}</span>
                <RemoveWarehouseStaffButton staffId={s.id} userId={s.userId} warehouseId={w.id} />
              </div>
            ))}
          </div>
        )}
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
                  <span className="text-neutral-700">{money(order.total)}</span>
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
