import Link from "@/components/Link";
import type { MoneyFormatter } from "@/lib/money";
import { getRiderProfile, getAvailableOrders, getActiveDelivery, getRiderTodayStats, getMyLiveOffer, getRiderPayProfile, type AvailableOrder } from "@/lib/rider";

import AcceptOrderButton from "@/components/rider/AcceptOrderButton";
import AvailabilityToggle from "@/components/rider/AvailabilityToggle";
import ActiveDeliveryCard from "@/components/rider/ActiveDeliveryCard";
import ExpressOfferCard from "@/components/rider/ExpressOfferCard";
import OffersPoller from "@/components/rider/OffersPoller";
import RiderLocationTracker from "@/components/rider/RiderLocationTracker";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getMoney } from "@/lib/tenant-server";

const DELIVERY_TYPE_KEY: Record<string, string> = {
  express: "checkout.express",
  standard: "checkout.standard",
  scheduled: "checkout.scheduled",
};

type T = (key: string, vars?: Record<string, string | number>) => string;

// The rider home is the work screen: online switch, the delivery in progress, and the orders waiting nearby.
// Earnings, payments and history live on their own pages (bottom tabs).
export default async function RiderHomePage() {
  const locale = await getServerLocale();
  const t: T = (key, vars) => translate(locale, key, vars);
  const money = await getMoney();
  const rider = await getRiderProfile();
  const activeDelivery = await getActiveDelivery();
  const isMatching = rider?.deliveryPartner.is_available && !activeDelivery;
  const payProfile = await getRiderPayProfile();
  const salaryOnly = !payProfile.earnsPerDelivery;
  const [todayStats, liveOffer, availableOrdersResult] = await Promise.all([
    getRiderTodayStats(),
    isMatching ? getMyLiveOffer() : Promise.resolve(null),
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

  const online = rider.deliveryPartner.is_available;
  const firstName = (rider.profile.full_name ?? "").trim().split(/\s+/)[0] || t("rider.rider");

  return (
    <div className="flex flex-col gap-4">
      {/* status bar */}
      <div className={`rounded-3xl p-4 text-white shadow-lg ${online ? "bg-gradient-to-br from-blue-700 to-sky-500 shadow-blue-600/20" : "bg-gradient-to-br from-neutral-700 to-neutral-500 shadow-neutral-600/20"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold">Hi, {firstName} 👋</p>
            <p className="text-xs text-white/80">{online ? "You are online and getting orders" : "You are offline. Go online to get orders"}</p>
          </div>
          <AvailabilityToggle isAvailable={online} size="lg" />
        </div>
        <Link href="/rider/earnings" className="mt-3 flex items-center justify-between rounded-2xl bg-white/15 px-3 py-2.5 text-sm active:scale-[0.99]">
          <span className="flex items-center gap-4">
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/70">Today</span>
              <span className="font-extrabold">{money(todayStats.earnings)}</span>
            </span>
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/70">Deliveries</span>
              <span className="font-extrabold">{todayStats.deliveries}</span>
            </span>
          </span>
          <span className="text-xs font-bold">Earnings →</span>
        </Link>
      </div>

      {isMatching && <OffersPoller />}
      {liveOffer && <ExpressOfferCard key={liveOffer.id} offer={liveOffer} salaryOnly={salaryOnly} />}

      {activeDelivery && <ActiveDeliveryCard delivery={activeDelivery} t={t} money={money} />}

      {!online && !activeDelivery && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-neutral-300 bg-white py-12 text-center">
          <span className="text-4xl">😴</span>
          <p className="font-semibold">{t("rider.youre_offline")}</p>
          <p className="px-6 text-sm text-neutral-500">{t("rider.go_online_hint")}</p>
        </div>
      )}

      {isMatching && (
        <section>
          <RiderLocationTracker />
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-extrabold text-neutral-900">{t("rider.nearby_orders")}</h2>
            {hasLocation && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {availableOrders.length} {availableOrders.length === 1 ? "order" : "orders"}
              </span>
            )}
          </div>
          {!hasLocation ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-sky-300 bg-sky-50 p-6 text-center">
              <span className="text-3xl">📍</span>
              <p className="text-sm font-semibold text-sky-900">{t("rider.share_location_title")}</p>
              <p className="text-xs text-sky-700">{t("rider.share_location_hint")}</p>
            </div>
          ) : availableOrders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-neutral-200 bg-white p-8 text-center">
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl">
                <span className="absolute inset-0 animate-ping rounded-full bg-blue-100" />
                <span className="relative">🛵</span>
              </span>
              <p className="font-semibold text-neutral-800">Looking for orders near you</p>
              <p className="text-sm text-neutral-500">{t("rider.no_orders_available")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {availableOrders.map((order) => (
                <AvailableOrderCard key={order.id} order={order} t={t} money={money} salaryOnly={salaryOnly} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** How urgent a Standard/Scheduled order is, for the rider: overdue, due today (within 24 h) or the promised date. */
function dueBadge(dueAt: string | null): { text: string; tone: string } | null {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms < 0) return { text: "⚠ Overdue", tone: "bg-blue-900 text-white" };
  const hours = ms / 3600000;
  if (hours < 24) return { text: `🕒 Due today · in ${Math.max(1, Math.round(hours))}h`, tone: "bg-sky-100 text-sky-900" };
  return { text: `📅 Due ${new Date(dueAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`, tone: "bg-neutral-100 text-neutral-600" };
}

function AvailableOrderCard({ order, t, money, salaryOnly = false }: { money: MoneyFormatter; order: AvailableOrder; t: T; salaryOnly?: boolean }) {
  const express = order.delivery_type === "express";
  const due = dueBadge(order.dueAt);
  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-extrabold text-neutral-900">#{order.order_number}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${express ? "bg-blue-100 text-blue-700" : "bg-neutral-100 text-neutral-600"}`}>
              {express ? "⚡ " : ""}
              {t(DELIVERY_TYPE_KEY[order.delivery_type] ?? "checkout.standard")}
            </span>
          </div>
          {order.warehouses && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-neutral-700">
              <span>📍</span>
              <span className="min-w-0">
                <span className="block font-semibold">{order.warehouses.name}</span>
                {order.warehouses.address_line && <span className="block truncate text-xs text-neutral-500">{order.warehouses.address_line}</span>}
              </span>
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            {order.distanceKm != null && (
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">🧭 {t("rider.km_away", { distance: order.distanceKm.toFixed(1) })}</span>
            )}
            {due && <span className={`rounded-full px-2.5 py-1 ${due.tone}`}>{due.text}</span>}
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600">
              📦 {order.item_count} {order.item_count === 1 ? "item" : "items"}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{salaryOnly ? "Pay" : "You earn"}</p>
          <p className="text-xl font-extrabold leading-tight text-blue-700">{salaryOnly ? "Salary" : money(order.riderPay)}</p>
        </div>
        <AcceptOrderButton orderId={order.id} />
      </div>
    </div>
  );
}
