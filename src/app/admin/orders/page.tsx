import Link from "next/link";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import FulfillmentBadge from "@/components/admin/FulfillmentBadge";
import OrdersKPIBar from "@/components/admin/OrdersKPIBar";
import OrdersQueueBoard from "@/components/admin/OrdersQueueBoard";
import OrdersLiveRefresher from "@/components/admin/OrdersLiveRefresher";
import { getAdminOrders, getAdminOrdersQueue, getAdminOrderKPIs } from "@/lib/admin-orders";
import { formatSAR, PAYMENT_METHOD_LABELS } from "@/lib/utils";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

const DELIVERY_TYPE_KEY: Record<string, string> = {
  express: "admin.delivery_express",
  standard: "admin.delivery_standard",
  scheduled: "admin.delivery_scheduled",
};

export default async function AdminOrdersPage() {
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

      <OrdersKPIBar kpis={kpis} t={t} />

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">📋 {t("admin.order_queue")}</p>
      <OrdersQueueBoard orders={queueOrders} t={t} />

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-baseline justify-between border-b border-neutral-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-700">🕓 {t("admin.recent_orders")}</h2>
          <p className="text-xs text-neutral-400">{t("admin.most_recent", { count: orders.length })}</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">{t("admin.order_col")}</th>
              <th className="px-4 py-2">{t("admin.customer_col")}</th>
              <th className="px-4 py-2">{t("admin.items_col")}</th>
              <th className="px-4 py-2">{t("admin.fulfilled_by_col")}</th>
              <th className="px-4 py-2">{t("admin.delivery_col")}</th>
              <th className="px-4 py-2">{t("admin.payment_col")}</th>
              <th className="px-4 py-2">{t("admin.total_col")}</th>
              <th className="px-4 py-2">{t("admin.status_col")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const payment = order.payments[0];
              const itemCount = order.order_items.reduce((sum, i) => sum + Number(i.ordered_quantity), 0);
              return (
                <tr key={order.id} className="border-t border-neutral-100 align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      #{order.order_number}
                    </Link>
                    <p className="text-xs text-neutral-400">
                      {new Date(order.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{order.profiles?.full_name ?? "—"}</p>
                    {order.profiles?.phone && (
                      <p className="text-xs text-neutral-500">{order.profiles.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {t("admin.lines", { count: order.order_items.length, plural: order.order_items.length === 1 ? "" : "s" })}
                    <p className="text-xs text-neutral-400">{t("admin.units", { count: itemCount })}</p>
                  </td>
                  <td className="px-4 py-3">
                    <FulfillmentBadge fulfillment={order.fulfillment} />
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {t(DELIVERY_TYPE_KEY[order.delivery_type] ?? "admin.delivery_standard")}
                    {order.addresses && (
                      <p className="text-xs text-neutral-400">
                        {[order.addresses.district, order.addresses.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {payment
                      ? payment.method === "cash_on_delivery"
                        ? t("admin.cash_on_delivery")
                        : (PAYMENT_METHOD_LABELS[payment.method] ?? payment.method)
                      : "—"}
                    {payment && (
                      <p className="text-xs capitalize text-neutral-400">{payment.status}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatSAR(order.total)}</td>
                  <td className="px-4 py-3">
                    <OrderStatusSelect orderId={order.id} status={order.status} />
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="mt-1 block text-xs text-blue-600 hover:underline"
                    >
                      {t("admin.view_details")}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
