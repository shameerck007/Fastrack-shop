import OrdersExplorer, { type ExplorerOrder } from "@/components/admin/OrdersExplorer";
import OrdersLiveRefresher from "@/components/admin/OrdersLiveRefresher";
import { PageHeader } from "@/components/admin/AdminUi";
import { getAdminOrders, getAdminOrderKPIs, type FulfillmentSummary } from "@/lib/admin-orders";
import { PAYMENT_METHOD_LABELS } from "@/lib/utils";
import { localizedName } from "@/lib/i18n/localized";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

const DELIVERY_TYPE_KEY: Record<string, string> = {
  express: "admin.delivery_express",
  standard: "admin.delivery_standard",
  scheduled: "admin.delivery_scheduled",
};

function fulfilment(f: FulfillmentSummary, t: (k: string, v?: Record<string, string | number>) => string): ExplorerOrder["fulfilledBy"] {
  if (!f.fromFastrack && f.merchantNames.length === 0) return { text: t("fulfillment.no_items"), tone: "none" };
  if (f.fromFastrack && f.merchantNames.length === 0) return { text: t("fulfillment.fastrack"), tone: "fastrack" };
  if (!f.fromFastrack && f.merchantNames.length === 1) return { text: t("fulfillment.merchant", { name: f.merchantNames[0] }), tone: "merchant" };
  return { text: t("fulfillment.mixed", { count: f.merchantNames.length + (f.fromFastrack ? 1 : 0) }), tone: "mixed" };
}

export default async function AdminOrdersPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const [kpis, orders] = await Promise.all([getAdminOrderKPIs(), getAdminOrders(100)]);

  const rows: ExplorerOrder[] = orders.map((order) => {
    const payment = order.payments[0];
    const names = order.order_items.map((i) => (i.product_variants?.products ? localizedName(i.product_variants.products, locale) : i.product_name));
    return {
      id: order.id,
      number: order.order_number,
      status: order.status,
      createdAt: order.created_at,
      customer: order.profiles?.full_name ?? t("admin.guest"),
      phone: order.profiles?.phone ?? null,
      itemCount: order.order_items.reduce((sum, i) => sum + Number(i.ordered_quantity), 0),
      itemsText: names.join(locale === "ar" ? "، " : ", "),
      thumbs: order.order_items.slice(0, 3).map((i) => i.product_variants?.products?.image_url ?? ""),
      delivery: t(DELIVERY_TYPE_KEY[order.delivery_type] ?? "admin.delivery_standard"),
      area: order.addresses ? [order.addresses.district, order.addresses.city].filter(Boolean).join(", ") || null : null,
      payment: payment ? (payment.method === "cash_on_delivery" ? t("admin.cash_on_delivery") : (PAYMENT_METHOD_LABELS[payment.method] ?? payment.method)) : "—",
      // Cash on delivery is settled when the rider hands it over, which is when the order is delivered.
      paid: payment?.status === "paid" || (payment?.method === "cash_on_delivery" && order.status === "delivered"),
      fulfilledBy: fulfilment(order.fulfillment, t),
      total: Number(order.total),
    };
  });

  return (
    <div>
      <PageHeader
        icon="🧾"
        title={t("admin.orders")}
        subtitle="Every order in one place. Tap a stage to filter, search by order, customer or product, and change the status right from the list."
        actions={<OrdersLiveRefresher />}
      />
      <OrdersExplorer
        orders={rows}
        counts={{ pending: kpis.queue.pending, preparing: kpis.queue.confirmedPreparing, ready: kpis.queue.readyForPickup, out: kpis.queue.outForDelivery }}
        today={{ orders: kpis.today.totalOrders, delivered: kpis.today.delivered, cancelled: kpis.today.cancelled, revenue: kpis.today.revenue }}
      />
    </div>
  );
}
