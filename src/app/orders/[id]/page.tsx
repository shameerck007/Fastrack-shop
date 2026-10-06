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
import { localizedName } from "@/lib/i18n/localized";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getMoney } from "@/lib/tenant-server";
import { moneyFor } from "@/lib/money";
import { getCurrentTenant } from "@/lib/tenant-server";
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
  const marketName = findCountry((await getCurrentTenant())?.country_code ?? "SA").name;
  const sameMarket = !order.country_code || order.country_code === ((await getCurrentTenant())?.country_code ?? "SA");
  const orderMoney = order.currency ? moneyFor(order.currency) : money;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rider = order.delivery_assignments?.delivery_partners ?? null;
  const showTrackingExtras = ["rider_assigned", "out_for_delivery"].includes(order.status);
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {!sameMarket && order.country_code && (
        <p className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
          <Flag code={order.country_code} className="me-1.5 h-3.5 w-[18px] align-[-2px]" /> This order was placed in {findCountry(order.country_code).name}. You are shopping in {marketName}.
        </p>
      )}
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
                }
              : null
          }
          dest={dest}
          shop={shop}
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
            <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold">
              <span>{t("checkout.total")}</span>
              <span>{orderMoney(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <LiveOrderStatus
        orderId={order.id}
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
    </div>
  );
}
