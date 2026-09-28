import Link from "next/link";
import { getRiderProfile, getAvailableOrders, getActiveDelivery } from "@/lib/rider";
import { formatSAR } from "@/lib/utils";
import AcceptOrderButton from "@/components/rider/AcceptOrderButton";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

const DELIVERY_TYPE_KEY: Record<string, string> = {
  express: "checkout.express",
  standard: "checkout.standard",
  scheduled: "checkout.scheduled",
};

export default async function RiderHomePage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const rider = await getRiderProfile();
  const activeDelivery = await getActiveDelivery();
  const availableOrders = rider?.deliveryPartner.is_available && !activeDelivery
    ? await getAvailableOrders()
    : [];

  if (!rider?.deliveryPartner.is_available) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
        <span className="text-4xl">😴</span>
        <p className="font-medium">{t("rider.youre_offline")}</p>
        <p className="text-sm text-neutral-500">{t("rider.go_online_hint")}</p>
      </div>
    );
  }

  if (activeDelivery) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold">{t("rider.active_delivery")}</h1>
        <Link
          href={`/rider/orders/${activeDelivery.id}`}
          className="block rounded-2xl border border-blue-200 bg-blue-50 p-4 hover:shadow-sm"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">#{activeDelivery.order_number}</p>
            <span className="rounded-full bg-blue-700 px-2 py-0.5 text-xs font-medium text-white">
              {t(`order_status.${activeDelivery.status}`)}
            </span>
          </div>
          {activeDelivery.warehouses && (
            <p className="text-sm text-neutral-600">{t("rider.pickup", { name: activeDelivery.warehouses.name })}</p>
          )}
          {activeDelivery.addresses && (
            <p className="text-sm text-neutral-600">{t("rider.drop", { address: activeDelivery.addresses.address_line })}</p>
          )}
          <p className="mt-2 text-sm font-semibold text-blue-700">
            {t("rider.earnings", { amount: formatSAR(activeDelivery.delivery_fee) })}
          </p>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{t("rider.nearby_orders")}</h1>
      {availableOrders.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
          {t("rider.no_orders_available")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {availableOrders.map((order) => (
            <AvailableOrderCard key={order.id} order={order} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function AvailableOrderCard({
  order,
  t,
}: {
  order: Awaited<ReturnType<typeof getAvailableOrders>>[number];
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">#{order.order_number}</p>
          <p className="text-sm text-neutral-500">
            {t("rider.items_and_type", {
              count: order.item_count,
              plural: order.item_count === 1 ? "" : "s",
              type: t(DELIVERY_TYPE_KEY[order.delivery_type] ?? "checkout.standard"),
            })}
          </p>
          {order.warehouses && (
            <p className="mt-1 text-sm text-neutral-600">📍 {order.warehouses.name}</p>
          )}
        </div>
        <div className="text-right">
          <p className="mb-1 font-semibold text-blue-700">{formatSAR(order.delivery_fee)}</p>
          <AcceptOrderButton orderId={order.id} />
        </div>
      </div>
    </div>
  );
}
