import { redirect } from "next/navigation";
import { getMerchantStats, getMyStore } from "@/lib/merchant";
import Link from "@/components/Link";
import PortalPageHeader from "@/components/ui/PortalPageHeader";
import { getMerchantOrders } from "@/lib/merchant-orders";

import { localizedName } from "@/lib/i18n/localized";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import PickupCodeBadge from "@/components/PickupCodeBadge";
import MerchantOrderStatusAction from "@/components/merchant/MerchantOrderStatusAction";
import type { OrderStatus } from "@/types/database";
import { getMoney } from "@/lib/tenant-server";

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-brand-50 text-brand-700",
  preparing: "bg-brand-50 text-brand-700",
  ready_for_pickup: "bg-brand-50 text-brand-700",
  rider_assigned: "bg-brand-50 text-brand-700",
  out_for_delivery: "bg-brand-50 text-brand-700",
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

  const tabLink = (key: string, label: string, count?: number) => (
    <Link
      key={key}
      href={key === "active" ? "/merchant/orders" : `/merchant/orders?tab=${key}`}
      aria-current={tab === key ? "page" : undefined}
      className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold transition ${tab === key ? "bg-white text-brand-800 shadow-sm ring-1 ring-neutral-200" : "text-neutral-500"}`}
    >
      {label}
      {count ? <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] leading-none text-white">{count}</span> : null}
    </Link>
  );

  // Three small numbers at the top: what needs the supplier's action first.
  const counter = (label: string, value: number, tone: string) => (
    <div className="rounded-2xl bg-white px-2 py-3 text-center shadow-sm ring-1 ring-neutral-200">
      <p className={`text-2xl font-extrabold leading-none tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1.5 text-[11px] font-semibold leading-tight text-neutral-500">{label}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <PortalPageHeader icon="🧾" title={t("merchant.orders_title")} subtitle={t("merchant.orders_intro")} />

      <div className="grid grid-cols-3 gap-2.5">
        {counter(t("merchant.new_orders"), stats.newOrders, "text-amber-600")}
        {counter(t("merchant.preparing_orders"), stats.preparing, "text-brand-700")}
        {counter(t("merchant.ready_orders"), stats.ready, "text-emerald-600")}
      </div>

      <div className="flex w-full rounded-full bg-neutral-100 p-1 sm:w-fit sm:min-w-[22rem]">
        {tabLink("active", "In progress", stats.newOrders)}
        {tabLink("done", "Completed")}
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-4xl">🧾</span>
          <p className="text-sm text-neutral-500">{tab === "done" ? "No completed orders yet" : t("merchant.no_orders_yet_merchant")}</p>
        </div>
      ) : (
        <div className="grid gap-3.5 lg:grid-cols-2">
          {orders.map((order) => {
            const itemCount = order.order_items.reduce((sum, i) => sum + Number(i.ordered_quantity), 0);
            const subtotal = order.order_items.reduce((sum, i) => sum + Number(i.line_total), 0);
            const shown = order.order_items.slice(0, 3);
            const extraCount = order.order_items.length - shown.length;
            const needsAction = order.status === "pending";
            const when = new Date(order.created_at);
            const tag = locale === "ar" ? "ar-SA" : "en-GB";

            return (
              <article key={order.id} className={`flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ${needsAction ? "ring-2 ring-amber-300" : "ring-1 ring-neutral-200"}`}>
                <header className="flex items-start justify-between gap-3 px-4 pt-3.5">
                  <div className="min-w-0">
                    <p className="text-base font-extrabold tracking-tight text-neutral-900">#{order.order_number}</p>
                    <p className="text-xs text-neutral-500">
                      {when.toLocaleDateString(tag, { day: "numeric", month: "short" })} · {when.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[order.status]}`}>{t(`order_status.${order.status}`)}</span>
                </header>

                <ul className="mt-3 flex flex-col gap-2 px-4">
                  {shown.map((item) => {
                    const product = item.product_variants?.products;
                    const name = product ? localizedName(product, locale) : item.product_name;
                    return (
                      <li key={item.id} className="flex items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
                          {product?.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xl">📦</span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-neutral-900">{name}</span>
                          <span className="block text-xs text-neutral-500">× {Number(item.ordered_quantity)}</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-neutral-700">{money(Number(item.line_total))}</span>
                      </li>
                    );
                  })}
                  {extraCount > 0 && <li className="ps-[3.75rem] text-xs font-semibold text-neutral-500">{t("orders.more_items", { count: extraCount })}</li>}
                </ul>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-2.5 text-sm">
                  <span className="text-neutral-500">{t("admin.units", { count: itemCount })}</span>
                  <span className="font-extrabold text-neutral-900">
                    <span className="me-1.5 text-xs font-medium text-neutral-500">{t("merchant.your_items")}</span>
                    {money(subtotal)}
                  </span>
                </div>

                <div className="mt-auto flex flex-col gap-2.5 bg-neutral-50 px-4 py-3">
                  <PickupCodeBadge orderId={order.id} status={order.status} />
                  <MerchantOrderStatusAction orderId={order.id} status={order.status} />
                  <p className="text-[11px] leading-snug text-neutral-500">{t("merchant.other_seller_note")}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
