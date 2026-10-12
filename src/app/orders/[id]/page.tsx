import { notFound } from "next/navigation";
import { getOrderDetail, getMyOrderRating } from "@/lib/orders";
import { getOrderMessages } from "@/lib/order-messages";
import { createClient } from "@/lib/supabase/server";

import DownloadInvoiceButton from "@/components/DownloadInvoiceButton";
import LiveOrderStatus from "@/components/LiveOrderStatus";
import RiderLocationMap from "@/components/RiderLocationMap";
import OrderTrackingHero from "@/components/OrderTrackingHero";
import OrderChat from "@/components/OrderChat";
import BuyItAgainButton from "@/components/BuyItAgainButton";
import OrderRatingForm from "@/components/OrderRatingForm";
import ReturnItemDialog from "@/components/ReturnItemDialog";
import ReturnCard from "@/components/ReturnCard";
import type { ReturnEligibility, ReturnRow } from "@/lib/returns";
import { localizedName } from "@/lib/i18n/localized";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getMoney } from "@/lib/tenant-server";
import { moneyFor } from "@/lib/money";
import { getActiveTenants, getCurrentTenant, isMarketPinnedAccount } from "@/lib/tenant-server";
import OrderOtherCountry from "@/components/OrderOtherCountry";
import { findCountry } from "@/lib/countries";
import Flag from "@/components/Flag";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const money = await getMoney();
  const { id } = await params;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const order = await getOrderDetail(id);

  if (!order) notFound();
  // An order keeps the currency it was placed in, whichever market the customer is browsing now.
  const currentTenant = await getCurrentTenant();
  const sameMarket = !order.country_code || order.country_code === (currentTenant?.country_code ?? "SA");
  // An order from another country is not shown here at all: only a note and the way to switch to it.
  if (!sameMarket && order.country_code) {
    return (
      <OrderOtherCountry
        orderCountry={order.country_code}
        tenants={await getActiveTenants()}
        currentId={currentTenant?.id ?? null}
        canSwitch={!(await isMarketPinnedAccount())}
      />
    );
  }
  const orderMoney = order.currency ? moneyFor(order.currency) : money;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rider = order.delivery_assignments?.delivery_partners ?? null;
  const showTrackingExtras = ["rider_assigned", "out_for_delivery"].includes(order.status);
  // The rider's rating, deliveries and vehicle (the rider card). Skipped quietly until migration 0090 is applied.
  const riderCard = rider && order.delivery_assignments?.rider_id
    ? (((await supabase.rpc("order_rider_card" as never, { p_order: order.id } as never)).data ?? null) as { rating?: number | null; rating_count?: number; deliveries?: number; vehicle?: string | null; vehicle_type?: string | null; plate_end?: string | null } | null)
    : null;
  const messages = rider && user ? await getOrderMessages(order.id) : [];
  const myRating = order.status === "delivered" ? await getMyOrderRating(order.id) : null;

  const activeOrder = !["delivered", "cancelled"].includes(order.status);
  const dest =
    order.addresses?.lat != null && order.addresses?.lng != null
      ? { lat: order.addresses.lat, lng: order.addresses.lng }
      : null;
  const shop =
    order.warehouses?.lat != null && order.warehouses?.lng != null
      ? { lat: order.warehouses.lat, lng: order.warehouses.lng, name: order.warehouses.name }
      : null;
  // Keeta-style tracking screen while the order is in flight (it has its own rider
  // card and map, so the plain ones below are skipped).
  const showTracking = activeOrder && !!(dest || shop);

  // Item returns (migration 0098): which items can still be returned, and the returns already raised. Left blank until the migration is applied.
  const returnRows: ReturnRow[] = (((await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { order: (c: string, o: object) => Promise<{ data: unknown }> } } } }).from("order_returns").select("*").eq("order_id", order.id).order("created_at", { ascending: false })).data ?? []) as ReturnRow[]);
  const eligibility = new Map<string, ReturnEligibility>();
  if (order.status === "delivered") {
    const rpc = async <T,>(fn: string, args: object): Promise<T | null> => ((await supabase.rpc(fn as never, args as never)).data ?? null) as T | null;
    const deliveredAt = await rpc<string>("order_delivered_at", { p_order: order.id });
    await Promise.all(
      order.order_items.map(async (item) => {
        const [windowDays, left] = await Promise.all([rpc<number>("return_window_for_item", { p_item: item.id }), rpc<number>("returnable_qty", { p_item: item.id })]);
        if (windowDays === null || left === null) return;
        const closesAt = deliveredAt ? new Date(new Date(deliveredAt).getTime() + Number(windowDays) * 86400000).toISOString() : null;
        eligibility.set(item.id, { left: Number(left), windowDays: Number(windowDays), closesAt });
      }),
    );
  }
  const returnCutoff = new Date().getTime();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {showTracking && (
        <OrderTrackingHero
          orderId={order.id}
          orderNumber={order.order_number}
          initialStatus={order.status}
          rider={
            rider && order.delivery_assignments?.rider_id
              ? {
                  id: order.delivery_assignments.rider_id,
                  name: rider.profiles.full_name,
                  phone: rider.profiles.phone,
                  lat: rider.current_lat,
                  lng: rider.current_lng,
                  rating: riderCard?.rating ?? null,
                  ratingCount: riderCard?.rating_count ?? 0,
                  deliveries: riderCard?.deliveries ?? 0,
                  vehicle: riderCard?.vehicle ?? (riderCard?.vehicle_type ? riderCard.vehicle_type.replace(/_/g, " ") : null),
                  plateEnd: riderCard?.plate_end ?? null,
                }
              : null
          }
          dest={dest}
          shop={shop}
          promisedAt={(order as unknown as { estimated_delivery_at?: string | null }).estimated_delivery_at ?? null}
          liveEtaAt={(order as unknown as { live_eta_at?: string | null }).live_eta_at ?? null}
          liveStops={(order as unknown as { live_eta_stops?: number | null }).live_eta_stops ?? null}
        />
      )}
      <h1 className="mb-1 text-2xl font-semibold">{t("orders.order_details_title")}</h1>
      <p className="mb-4 flex flex-wrap items-center gap-x-2 text-sm text-neutral-500">
        <span>
          {t("orders.placed_on")}{" "}
          {new Date(order.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
        </span>
        <span className="text-neutral-300">|</span>
        <span>{t("orders.order_hash", { number: order.order_number })}</span>
        <span className="text-neutral-300">|</span>
        <DownloadInvoiceButton orderId={order.id} orderNumber={order.order_number} variant="link" />
      </p>

      <div className="mb-6 grid gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-3 sm:divide-x sm:divide-neutral-100 rtl:sm:divide-x-reverse">
        <div className="sm:pe-4">
          <p className="mb-1 font-medium text-neutral-900">{t("orders.ship_to")}</p>
          {order.addresses ? (
            <div className="text-sm text-neutral-600">
              {order.addresses.receiver_name && <p className="text-neutral-900">{order.addresses.receiver_name}</p>}
              <p>{order.addresses.address_line}</p>
              {(order.addresses.building_number || order.addresses.unit_number) && (
                <p>
                  {[
                    order.addresses.building_number && `${t("addresses.bldg_short")} ${order.addresses.building_number}`,
                    order.addresses.unit_number && `${t("addresses.unit_short")} ${order.addresses.unit_number}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              <p>{[order.addresses.district, order.addresses.city, order.addresses.state, order.addresses.state ? order.addresses.postal_code : null].filter(Boolean).join(", ")}</p>
              {order.addresses.receiver_phone && (
                <a href={`tel:${order.addresses.receiver_phone}`} className="text-blue-600 hover:underline">
                  📞 {order.addresses.receiver_phone}
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">—</p>
          )}
        </div>

        <div className="sm:px-4">
          <p className="mb-1 font-medium text-neutral-900">{t("orders.payment_label")}</p>
          <p className="text-sm text-neutral-600">💵 {t("account.cash_on_delivery")}</p>
        </div>

        <div className="sm:ps-4">
          <p className="mb-1 font-medium text-neutral-900">{t("orders.order_summary")}</p>
          <div className="space-y-0.5 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">{t("orders.item_subtotal")}</span>
              <span>{orderMoney(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">{t("checkout.delivery_fee")}</span>
              <span>{order.delivery_fee === 0 ? t("checkout.free") : orderMoney(order.delivery_fee)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>{t("orders.discount")}</span>
                <span>-{orderMoney(order.discount)}</span>
              </div>
            )}
            {Number((order as unknown as { refunded_amount?: number | string | null }).refunded_amount ?? 0) > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Refunded</span>
                <span>-{orderMoney(Number((order as unknown as { refunded_amount?: number | string | null }).refunded_amount))}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold">
              <span>{t("checkout.total")}</span>
              <span>{orderMoney(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <LiveOrderStatus
        orderId={order.id}
        orderNumber={order.order_number}
        initialStatus={order.status}
        deliveryOtp={order.delivery_otp}
        statusHistory={order.order_status_history}
      />

      {order.status === "delivered" && (
        <div className="mb-6">
          <OrderRatingForm orderId={order.id} existingRating={myRating} />
        </div>
      )}

      {rider && !showTracking && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">{t("orders.rider")}</p>
          <p className="font-medium">{rider.profiles.full_name}</p>
          {rider.profiles.phone && (
            <a href={`tel:${rider.profiles.phone}`} className="text-sm text-blue-600 hover:underline">
              📞 {rider.profiles.phone}
            </a>
          )}

          {showTrackingExtras && order.delivery_assignments?.rider_id && (
            <div className="mt-3">
              <RiderLocationMap
                riderId={order.delivery_assignments.rider_id}
                initialLat={rider.current_lat}
                initialLng={rider.current_lng}
              />
            </div>
          )}
        </div>
      )}

      {rider && user && (
        <div id="order-chat" className="mb-6 scroll-mt-4">
          <OrderChat
            orderId={order.id}
            currentUserId={user.id}
            otherPartyLabel="rider"
            initialMessages={messages}
          />
        </div>
      )}

      <div className="mb-6 rounded-xl border border-neutral-200 bg-white">
        {order.order_items.map((item) => {
          const product = item.product_variants?.products;
          const name = product ? localizedName(product, locale) : item.product_name;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 border-b border-neutral-100 p-4 last:border-none"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
                {product?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl">📦</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{name}</p>
                <p className="text-sm text-neutral-500">
                  {item.variant_label} × {item.ordered_quantity}
                  {item.is_substituted && (
                    <span className="ms-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                      {t("product.substituted")}
                    </span>
                  )}
                </p>
                {(() => {
                  const e = eligibility.get(item.id);
                  if (!e) return null;
                  if (e.windowDays <= 0) return <p className="mt-1 text-xs text-neutral-400">Not returnable</p>;
                  if (e.closesAt && new Date(e.closesAt).getTime() < returnCutoff) return <p className="mt-1 text-xs text-neutral-400">Return period ended</p>;
                  if (e.left <= 0) return null;
                  return (
                    <div className="mt-1.5">
                      <ReturnItemDialog orderId={order.id} itemId={item.id} name={name} variant={item.variant_label} maxQty={Math.floor(e.left)} closesAt={e.closesAt} />
                    </div>
                  );
                })()}
              </div>
              <span className="font-medium">{orderMoney(item.line_total)}</span>
            </div>
          );
        })}
        {order.status !== "cancelled" && sameMarket && (
          <div className="p-4">
            <BuyItAgainButton orderId={order.id} itemCount={order.order_items.length} />
          </div>
        )}
      </div>

      {returnRows.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">Returns</h2>
          <div className="flex flex-col gap-3">
            {returnRows.map((ret) => (
              <ReturnCard key={ret.id} orderId={order.id} ret={ret} itemName={order.order_items.find((i) => i.id === ret.order_item_id)?.product_name ?? "Item"} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
