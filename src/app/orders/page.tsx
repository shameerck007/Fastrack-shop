import Link from "next/link";
import { getMyOrders, getOtherMarketOrderCounts, type OrderListItem } from "@/lib/orders";
import OtherMarketOrdersNote from "@/components/OtherMarketOrdersNote";

import { localizedName } from "@/lib/i18n/localized";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import BuyItAgainButton from "@/components/BuyItAgainButton";
import DownloadInvoiceButton from "@/components/DownloadInvoiceButton";
import type { OrderStatus } from "@/types/database";
import { getMoney } from "@/lib/tenant-server";
import { moneyFor } from "@/lib/money";
import { getActiveTenants, getCurrentTenant } from "@/lib/tenant-server";
import { findCountry } from "@/lib/countries";

const ACTIVE_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "rider_assigned",
  "out_for_delivery",
];

function headline(
  order: OrderListItem,
  locale: string,
  t: (key: string, vars?: Record<string, string | number>) => string
): { text: string; color: string } {
  const date = new Date(order.updated_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (order.status === "delivered") return { text: t("orders.delivered_on", { date }), color: "text-emerald-700" };
  if (order.status === "cancelled") return { text: t("orders.cancelled_on"), color: "text-red-600" };
  return { text: t(`order_status.${order.status}`), color: "text-blue-700" };
}

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
  const money = await getMoney();
  const currentTenant = await getCurrentTenant();
  const marketCountry = currentTenant?.country_code ?? "SA";
  const { filter = "all" } = await searchParams;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const [orders, otherCounts, tenants] = await Promise.all([getMyOrders(), getOtherMarketOrderCounts(), getActiveTenants()]);
  const visible = orders.filter((o) => matchesFilter(o, filter));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold max-md:hidden">{t("orders.title")}</h1>

      {currentTenant && <OtherMarketOrdersNote tenants={tenants} currentId={currentTenant.id} others={otherCounts} />}

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
                const head = headline(order, locale, t);

                return (
                  <div key={order.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    {/* Amazon-style header strip: placed/total/deliver-to on one
                        side, order # + compact "View order details | Invoice"
                        text links on the other — no boxed invoice button here. */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-500 sm:text-sm">
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <span>
                          <span className="block text-neutral-400">{t("orders.order_placed_label")}</span>
                          <span className="text-neutral-700">
                            {new Date(order.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                          </span>
                        </span>
                        {order.country_code && order.country_code !== marketCountry && (
                          <span className="self-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                            {findCountry(order.country_code).flag} {findCountry(order.country_code).name}
                          </span>
                        )}
                        <span>
                          <span className="block text-neutral-400">{t("orders.total_label")}</span>
                          <span className="text-neutral-700">{(order.currency ? moneyFor(order.currency) : money)(order.total)}</span>
                        </span>
                        {shipTo && (
                          <span className="hidden sm:inline">
                            <span className="block text-neutral-400">{t("orders.deliver_to_label")}</span>
                            <span className="text-neutral-700">{shipTo}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-end">
                        <span className="block text-neutral-400">{t("orders.order_hash", { number: order.order_number })}</span>
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <Link href={`/orders/${order.id}`} className="font-medium text-blue-700 hover:underline">
                            {t("orders.view_order_details")}
                          </Link>
                          <span className="text-neutral-300">|</span>
                          <DownloadInvoiceButton orderId={order.id} orderNumber={order.order_number} variant="link" />
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <Link href={`/orders/${order.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90">
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
                          <p className={`font-semibold ${head.color}`}>{head.text}</p>
                          <p className="truncate text-sm text-neutral-500">
                            {order.order_items
                              .map((i) => (i.product_variants?.products ? localizedName(i.product_variants.products, locale) : i.product_name))
                              .join(locale === "ar" ? "، " : ", ")}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {t("orders.items_count", { count: itemCount, plural: itemCount === 1 ? "" : "s" })}
                          </p>
                        </div>
                      </Link>

                      <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-48">
                        {order.status !== "cancelled" && (!order.country_code || order.country_code === marketCountry) && (
                          <BuyItAgainButton orderId={order.id} itemCount={order.order_items.length} fullWidth />
                        )}
                        <Link
                          href={`/orders/${order.id}`}
                          className="w-full rounded-full border border-neutral-300 px-4 py-1.5 text-center text-sm font-medium hover:bg-neutral-100"
                        >
                          {t("orders.view_order_details")}
                        </Link>
                      </div>
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
