import Link from "next/link";
import { getMyOrders, type OrderListItem } from "@/lib/orders";
import { formatSAR } from "@/lib/utils";
import { localizedName } from "@/lib/i18n/localized";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import BuyItAgainButton from "@/components/BuyItAgainButton";
import type { OrderStatus } from "@/types/database";

const ACTIVE_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "rider_assigned",
  "out_for_delivery",
];

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

const FILTERS = [
  { key: "all", labelKey: "orders.filter_all" },
  { key: "active", labelKey: "orders.filter_active" },
  { key: "delivered", labelKey: "orders.filter_delivered" },
  { key: "cancelled", labelKey: "orders.filter_cancelled" },
] as const;

function matchesFilter(order: OrderListItem, filter: string) {
  if (filter === "active") return ACTIVE_STATUSES.includes(order.status);
  if (filter === "delivered") return order.status === "delivered";
  if (filter === "cancelled") return order.status === "cancelled";
  return true;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const orders = await getMyOrders();
  const visible = orders.filter((o) => matchesFilter(o, filter));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">{t("orders.title")}</h1>

      {orders.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {t("orders.no_orders")}. <Link href="/" className="text-blue-600 hover:underline">{t("cart.start_shopping")}</Link>.
        </p>
      ) : (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto border-b border-neutral-200 pb-px">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? "/orders" : `/orders?filter=${f.key}`}
                className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
                  filter === f.key
                    ? "border-blue-700 text-blue-700"
                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {t(f.labelKey)}
              </Link>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("orders.no_orders_in_filter")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {visible.map((order) => {
                const itemCount = order.order_items.reduce((sum, i) => sum + i.ordered_quantity, 0);
                const thumbnails = order.order_items.slice(0, 4);
                const extraCount = order.order_items.length - thumbnails.length;
                const shipTo = order.addresses?.short_address || order.addresses?.city;
                const payment = order.payments[0]?.method;

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
                          <span className="block text-neutral-400">{t("orders.total_label")}</span>
                          <span className="text-neutral-700">{formatSAR(order.total)}</span>
                        </span>
                        {shipTo && (
                          <span className="hidden sm:inline">
                            <span className="block text-neutral-400">{t("orders.ship_to")}</span>
                            <span className="text-neutral-700">{shipTo}</span>
                          </span>
                        )}
                        {payment && (
                          <span className="hidden sm:inline">
                            <span className="block text-neutral-400">{t("orders.payment_label")}</span>
                            <span className="text-neutral-700">{t("account.cash_on_delivery")}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-end">
                        <span className="block text-neutral-400">{t("orders.order_hash", { number: order.order_number })}</span>
                        <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[order.status]}`}>
                          {t(`order_status.${order.status}`)}
                        </span>
                      </div>
                    </div>

                    <Link href={`/orders/${order.id}`} className="flex items-center gap-3 p-4 hover:bg-neutral-50">
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
                          {t("orders.items_count", { count: itemCount, plural: itemCount === 1 ? "" : "s" })}
                        </p>
                      </div>
                    </Link>

                    <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-100"
                      >
                        {t("orders.view_order_details")}
                      </Link>
                      {order.status !== "cancelled" && (
                        <BuyItAgainButton orderId={order.id} itemCount={order.order_items.length} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
