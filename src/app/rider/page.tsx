import LandingPreferenceCard from "@/components/LandingPreferenceCard";
import type { MoneyFormatter } from "@/lib/money";
import {
  getRiderProfile,
  getAvailableOrders,
  getActiveDelivery,
  getRiderTodayStats,
  getRiderLifetimeStats,
  getWeeklyEarnings,
  type AvailableOrder,
} from "@/lib/rider";

import AcceptOrderButton from "@/components/rider/AcceptOrderButton";
import RiderProfileCard from "@/components/rider/RiderProfileCard";
import RiderStatsGrid from "@/components/rider/RiderStatsGrid";
import RiderEarningsChart from "@/components/rider/RiderEarningsChart";
import ActiveDeliveryCard from "@/components/rider/ActiveDeliveryCard";
import RiderLocationTracker from "@/components/rider/RiderLocationTracker";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getMoney } from "@/lib/tenant-server";

const DELIVERY_TYPE_KEY: Record<string, string> = {
  express: "checkout.express",
  standard: "checkout.standard",
  scheduled: "checkout.scheduled",
};

export default async function RiderHomePage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const money = await getMoney();
  const rider = await getRiderProfile();
  const activeDelivery = await getActiveDelivery();
  const isMatching = rider?.deliveryPartner.is_available && !activeDelivery;
  const [todayStats, lifetimeStats, weeklyEarnings, availableOrdersResult] = await Promise.all([
    getRiderTodayStats(),
    getRiderLifetimeStats(),
    getWeeklyEarnings(),
    isMatching ? getAvailableOrders() : Promise.resolve({ orders: [], hasLocation: false }),
  ]);
  const { orders: availableOrders, hasLocation } = availableOrdersResult;

  if (!rider) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
        <span className="text-4xl">😴</span>
        <p className="font-medium">{t("rider.youre_offline")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <RiderProfileCard profile={rider.profile} deliveryPartner={rider.deliveryPartner} t={t} locale={locale} />

      <RiderStatsGrid
        money={money}
        todayDeliveries={todayStats.deliveries}
        todayEarnings={todayStats.earnings}
        totalDeliveries={lifetimeStats?.totalDeliveries ?? 0}
        rating={lifetimeStats?.rating ?? null}
        t={t}
      />

      <RiderEarningsChart days={weeklyEarnings} t={t} money={money} />

      {!rider.deliveryPartner.is_available && !activeDelivery && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white py-12 text-center">
          <span className="text-4xl">😴</span>
          <p className="font-medium">{t("rider.youre_offline")}</p>
          <p className="text-sm text-neutral-500">{t("rider.go_online_hint")}</p>
        </div>
      )}

      {activeDelivery && <ActiveDeliveryCard delivery={activeDelivery} t={t} money={money} />}

      {isMatching && (
        <div>
          <RiderLocationTracker />
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">{t("rider.nearby_orders")}</h2>
          {!hasLocation ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6 text-center">
              <span className="text-2xl">📍</span>
              <p className="text-sm font-medium text-amber-800">{t("rider.share_location_title")}</p>
              <p className="text-xs text-amber-700">{t("rider.share_location_hint")}</p>
            </div>
          ) : availableOrders.length === 0 ? (
            <p className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
              {t("rider.no_orders_available")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {availableOrders.map((order) => (
                <AvailableOrderCard key={order.id} order={order} t={t} money={money} />
              ))}
            </div>
          )}
        </div>
      )}
      <LandingPreferenceCard />
    </div>
  );
}

function AvailableOrderCard({
  order,
  t,
  money,
}: {
  money: MoneyFormatter;
  order: AvailableOrder;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
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
          {order.distanceKm != null && (
            <p className="mt-0.5 text-xs font-medium text-blue-600">
              {t("rider.km_away", { distance: order.distanceKm.toFixed(1) })}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="mb-1 font-semibold text-blue-700">{money(order.delivery_fee)}</p>
          <AcceptOrderButton orderId={order.id} />
        </div>
      </div>
    </div>
  );
}
