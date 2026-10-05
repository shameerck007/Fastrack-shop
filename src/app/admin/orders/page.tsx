import Link from "next/link";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import FulfillmentBadge from "@/components/admin/FulfillmentBadge";
import OrdersKPIBar from "@/components/admin/OrdersKPIBar";
import OrdersQueueBoard from "@/components/admin/OrdersQueueBoard";
import OrdersLiveRefresher from "@/components/admin/OrdersLiveRefresher";
import { getAdminOrders, getAdminOrdersQueue, getAdminOrderKPIs } from "@/lib/admin-orders";
import { PAYMENT_METHOD_LABELS } from "@/lib/utils";
import { localizedName } from "@/lib/i18n/localized";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import type { OrderStatus } from "@/types/database";
import { getMoney } from "@/lib/tenant-server";

const DELIVERY_TYPE_KEY: Record<string, string> = {
  express: "admin.delivery_express",
  standard: "admin.delivery_standard",
  scheduled: "admin.delivery_scheduled",
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  preparing: "bg-blue-50 text-blue-700",
  ready_for_pickup: "bg-blue-50 text-blue-700",
  rider_assigned: "bg-blue-50 text-blue-700",
  out_for_delivery: "bg-blue-50 text-blue-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
};

export default async function AdminOrdersPage() {
  const money = await getMoney();
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const [kpis, queueOrders, orders] = await Promise.all([
    getAdminOrderKPIs(),
    getAdminOrdersQueue(),
    getAdminOrders(50),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{t("admin.orders")}</h1>
          <OrdersLiveRefresher />
        </div>
      </div>

      <OrdersKPIBar kpis={kpis} t={t} money={money} />

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">📋 {t("admin.order_queue")}</p>
      <OrdersQueueBoard orders={queueOrders} t={t} money={money} />

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">🕓 {t("admin.recent_orders")}</h2>
        <p className="text-xs text-neutral-400">{t("admin.most_recent", { count: orders.length })}</p>
      </div>

      <div className="flex flex-col gap-4">
        {orders.map((order) => {
          const payment = order.payments[0];
          const itemCount = order.order_items.reduce((sum, i) => sum + Number(i.ordered_quantity), 0);
          const thumbnails = order.order_items.slice(0, 4);
          const extraCount = order.order_items.length - thumbnails.length;

          return (
            <div key={order.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-500 sm:text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span>
                    <span className="block text-neutral-400">{t("orders.placed_on")}</span>
                    <span className="text-neutral-700">
                      {new Date(order.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                    </span>
                  </span>
                  <span>
                    <span className="block text-neutral-400">{t("admin.customer_col")}</span>
                    <span className="text-neutral-700">{order.profiles?.full_name ?? "—"}</span>
                    {order.profiles?.phone && <span className="block text-neutral-400">{order.profiles.phone}</span>}
                  </span>
                  <span className="hidden sm:inline">
                    <span className="block text-neutral-400">{t("admin.fulfilled_by_col")}</span>
                    <FulfillmentBadge fulfillment={order.fulfillment} />
                  </span>
                  <span className="hidden sm:inline">
                    <span className="block text-neutral-400">{t("admin.delivery_col")}</span>
                    <span className="text-neutral-700">
                      {t(DELIVERY_TYPE_KEY[order.delivery_type] ?? "admin.delivery_standard")}
                    </span>
                    {order.addresses && (
                      <span className="block text-neutral-400">
                        {[order.addresses.district, order.addresses.city].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </span>
                  <span className="hidden sm:inline">
                    <span className="block text-neutral-400">{t("admin.payment_col")}</span>
                    <span className="text-neutral-700">
                      {payment
                        ? payment.method === "cash_on_delivery"
                          ? t("admin.cash_on_delivery")
                          : (PAYMENT_METHOD_LABELS[payment.method] ?? payment.method)
                        : "—"}
                    </span>
                  </span>
                  <span>
                    <span className="block text-neutral-400">{t("orders.total_label")}</span>
                    <span className="font-medium text-neutral-700">{money(order.total)}</span>
                  </span>
                </div>
                <div className="text-end">
                  <span className="block text-neutral-400">
                    {t("orders.order_hash", { number: order.order_number })}
                  </span>
                  <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[order.status]}`}>
                    {t(`order_status.${order.status}`)}
                  </span>
                </div>
              </div>

              <Link href={`/admin/orders/${order.id}`} className="flex items-center gap-3 p-4 hover:bg-neutral-50">
                <div className="flex shrink-0 -space-x-2 rtl:space-x-reverse">
                  {thumbnails.map((item) => {
                    const product = item.product_variants?.products;
                    const name = product ? localizedName(product, locale) : item.product_name;
                    return (
                      <div
                        key={item.id}
                        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-neutral-100 shadow-sm"
                      >
                        {product?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image_url} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xl">📦</span>
                        )}
                      </div>
                    );
                  })}
                  {extraCount > 0 && (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-white bg-neutral-800 text-xs font-medium text-white shadow-sm">
                      {t("orders.more_items", { count: extraCount })}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-700">
                    {order.order_items
                      .map((i) => (i.product_variants?.products ? localizedName(i.product_variants.products, locale) : i.product_name))
                      .join(locale === "ar" ? "، " : ", ")}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {t("admin.lines", { count: order.order_items.length, plural: order.order_items.length === 1 ? "" : "s" })}
                    {" · "}
                    {t("admin.units", { count: itemCount })}
                  </p>
                </div>
              </Link>

              <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 px-4 py-3">
                <OrderStatusSelect orderId={order.id} status={order.status} />
                <Link href={`/admin/orders/${order.id}`} className="text-sm text-blue-600 hover:underline">
                  {t("admin.view_details")}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
