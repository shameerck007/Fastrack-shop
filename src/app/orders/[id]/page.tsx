import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/orders";
import { getOrderMessages } from "@/lib/order-messages";
import { createClient } from "@/lib/supabase/server";
import { formatSAR } from "@/lib/utils";
import DownloadInvoiceButton from "@/components/DownloadInvoiceButton";
import LiveOrderStatus from "@/components/LiveOrderStatus";
import RiderLocationMap from "@/components/RiderLocationMap";
import OrderChat from "@/components/OrderChat";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
          <h1 className="text-xl font-semibold">Order #{order.order_number}</h1>
          <p className="text-sm text-neutral-500">
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <DownloadInvoiceButton orderId={order.id} />
      </div>

      <LiveOrderStatus orderId={order.id} initialStatus={order.status} deliveryOtp={order.delivery_otp} />

      {rider && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">Rider</p>
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
        {order.order_items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between border-b border-neutral-100 p-4 last:border-none"
          >
            <div>
              <p className="font-medium">{item.product_name}</p>
              <p className="text-sm text-neutral-500">
                {item.variant_label} × {item.ordered_quantity}
                {item.is_substituted && (
                  <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                    Substituted
                  </span>
                )}
              </p>
            </div>
            <span className="font-medium">{formatSAR(item.line_total)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">Subtotal (incl. VAT)</span>
          <span>{formatSAR(order.subtotal)}</span>
        </div>
        <div className="flex justify-between pl-3 text-xs">
          <span className="text-neutral-400">of which VAT (15%)</span>
          <span className="text-neutral-400">{formatSAR(order.vat)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Delivery fee</span>
          <span>{order.delivery_fee === 0 ? "Free" : formatSAR(order.delivery_fee)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between text-blue-600">
            <span>Discount</span>
            <span>-{formatSAR(order.discount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold">
          <span>Total</span>
          <span>{formatSAR(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
