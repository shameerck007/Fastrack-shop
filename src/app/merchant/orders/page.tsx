import { redirect } from "next/navigation";
import { getMerchantStats, getMyStore } from "@/lib/merchant";
import Link from "@/components/Link";
import { PageHeader, StatGrid, StatTile } from "@/components/admin/AdminUi";
import { getMerchantOrders } from "@/lib/merchant-orders";

import { localizedName } from "@/lib/i18n/localized";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import MerchantOrderStatusAction from "@/components/merchant/MerchantOrderStatusAction";
import type { OrderStatus } from "@/types/database";
import { getMoney } from "@/lib/tenant-server";

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

export default async function MerchantOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : "active";
  const money = await getMoney();
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const store = await getMyStore();
  if (!store) redirect("/sell");

  const [orders, stats] = await Promise.all([getMerchantOrders(50, tab), getMerchantStats(store.id)]);

  const tabLink = (key: string, label: string) => (
    <Link
      key={key}
      href={key === "active" ? "/merchant/orders" : `/merchant/orders?tab=${key}`}
      className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-bold ${tab === key ? "bg-blue-700 text-white shadow" : "text-neutral-500"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader icon="🧾" title={t("merchant.orders_title")} subtitle={t("merchant.orders_intro")} />

      <StatGrid>
        <StatTile icon="🔔" label={t("merchant.new_orders")} value={stats.newOrders} accent="#d97706" />
        <StatTile icon="👨‍🍳" label={t("merchant.preparing_orders")} value={stats.preparing} accent="#2563eb" />
        <StatTile icon="✅" label={t("merchant.ready_orders")} value={stats.ready} accent="#059669" />
      </StatGrid>

      <div className="flex w-fit rounded-full bg-neutral-100 p-0.5">
        {tabLink("active", "In progress")}
        {tabLink("done", "Completed")}
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-4xl">🧾</span>
          <p className="text-sm text-neutral-500">{tab === "done" ? "No completed orders yet" : t("merchant.no_orders_yet_merchant")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const itemCount = order.order_items.reduce((sum, i) => sum + Number(i.ordered_quantity), 0);
            const subtotal = order.order_items.reduce((sum, i) => sum + Number(i.line_total), 0);
            const thumbnails = order.order_items.slice(0, 4);
            const extraCount = order.order_items.length - thumbnails.length;

            return (
              <div key={order.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-500 sm:text-sm">
                  <span>
                    <span className="block text-neutral-400">{t("orders.placed_on")}</span>
                    <span className="text-neutral-700">
                      {new Date(order.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                    </span>
                  </span>
                  <span>
                    <span className="block text-neutral-400">{t("merchant.your_items")}</span>
                    <span className="font-medium text-neutral-700">{money(subtotal)}</span>
                  </span>
                  <div className="text-end">
                    <span className="block text-neutral-400">
                      {t("orders.order_hash", { number: order.order_number })}
                    </span>
                    <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[order.status]}`}>
                      {t(`order_status.${order.status}`)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4">
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
                    <p className="text-xs text-neutral-400">{t("admin.units", { count: itemCount })}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3">
                  <p className="text-xs text-neutral-400">{t("merchant.other_seller_note")}</p>
                  <MerchantOrderStatusAction orderId={order.id} status={order.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
