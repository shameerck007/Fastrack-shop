import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/orders";
import { getOrderMessages } from "@/lib/order-messages";
import { createClient } from "@/lib/supabase/server";
import { formatSAR } from "@/lib/utils";
import DownloadInvoiceButton from "@/components/DownloadInvoiceButton";
import LiveOrderStatus from "@/components/LiveOrderStatus";
import RiderLocationMap from "@/components/RiderLocationMap";
import OrderChat from "@/components/OrderChat";
import BuyItAgainButton from "@/components/BuyItAgainButton";
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("orders.order_hash", { number: order.order_number })}</h1>
          <p className="text-sm text-neutral-500">
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <DownloadInvoiceButton orderId={order.id} orderNumber={order.order_number} />
      </div>

      <LiveOrderStatus orderId={order.id} initialStatus={order.status} deliveryOtp={order.delivery_otp} />

      {order.addresses && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
          <p className="mb-1 font-medium text-neutral-900">{t("orders.ship_to")}</p>
          {order.addresses.receiver_name && <p>{order.addresses.receiver_name}</p>}
          <p className="text-neutral-600">
            {[
              order.addresses.address_line,
              order.addresses.building_number && `${t("addresses.bldg_short")} ${order.addresses.building_number}`,
              order.addresses.unit_number && `${t("addresses.unit_short")} ${order.addresses.unit_number}`,
              order.addresses.district,
              order.addresses.city,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          {order.addresses.receiver_phone && (
            <a href={`tel:${order.addresses.receiver_phone}`} className="text-blue-600 hover:underline">
              📞 {order.addresses.receiver_phone}
            </a>
          )}
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

      <div className="space-y-1 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">{t("checkout.subtotal_incl_vat")}</span>
          <span>{formatSAR(order.subtotal)}</span>
        </div>
        <div className="flex justify-between ps-3 text-xs">
          <span className="text-neutral-400">{t("checkout.of_which_vat")}</span>
          <span className="text-neutral-400">{formatSAR(order.vat)}</span>
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
        {order.payments[0]?.method && (
          <div className="flex justify-between border-t border-neutral-200 pt-1">
            <span className="text-neutral-500">{t("orders.payment_label")}</span>
            <span>{t("account.cash_on_delivery")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
