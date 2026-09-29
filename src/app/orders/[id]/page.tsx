import { notFound } from "next/navigation";
import { getOrderDetail, getMyOrderRating } from "@/lib/orders";
import { getOrderMessages } from "@/lib/order-messages";
import { createClient } from "@/lib/supabase/server";
import { formatSAR } from "@/lib/utils";
import DownloadInvoiceButton from "@/components/DownloadInvoiceButton";
import LiveOrderStatus from "@/components/LiveOrderStatus";
import RiderLocationMap from "@/components/RiderLocationMap";
import OrderChat from "@/components/OrderChat";
import BuyItAgainButton from "@/components/BuyItAgainButton";
import OrderRatingForm from "@/components/OrderRatingForm";
import { localizedName } from "@/lib/i18n/localized";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const order = await getOrderDetail(id);

  if (!order) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rider = order.delivery_assignments?.delivery_partners ?? null;
  const showTrackingExtras = ["rider_assigned", "out_for_delivery"].includes(order.status);
  const messages = rider && user ? await getOrderMessages(order.id) : [];
  const myRating = order.status === "delivered" ? await getMyOrderRating(order.id) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("orders.order_details_title")}</h1>
        <DownloadInvoiceButton orderId={order.id} orderNumber={order.order_number} />
      </div>
      <p className="mb-4 flex flex-wrap items-center gap-x-2 text-sm text-neutral-500">
        <span>
          {t("orders.placed_on")}{" "}
          {new Date(order.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
        </span>
        <span className="text-neutral-300">|</span>
        <span>{t("orders.order_hash", { number: order.order_number })}</span>
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
              <p>{[order.addresses.district, order.addresses.city].filter(Boolean).join(", ")}</p>
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
              <span>{formatSAR(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">{t("checkout.delivery_fee")}</span>
              <span>{order.delivery_fee === 0 ? t("checkout.free") : formatSAR(order.delivery_fee)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>{t("orders.discount")}</span>
                <span>-{formatSAR(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold">
              <span>{t("checkout.total")}</span>
              <span>{formatSAR(order.total)}</span>
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

      {rider && (
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
        <div className="mb-6">
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
              <span className="font-medium">{formatSAR(item.line_total)}</span>
            </div>
          );
        })}
        {order.status !== "cancelled" && (
          <div className="p-4">
            <BuyItAgainButton orderId={order.id} itemCount={order.order_items.length} />
          </div>
        )}
      </div>
    </div>
  );
}
