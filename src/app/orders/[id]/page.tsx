import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/orders";
import { formatSAR, ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from "@/lib/utils";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderDetail(id);

  if (!order) notFound();

  const isCancelled = order.status === "cancelled";
  const currentStepIndex = ORDER_STATUS_FLOW.indexOf(
    order.status as (typeof ORDER_STATUS_FLOW)[number]
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Order #{order.order_number}</h1>
          <p className="text-sm text-neutral-500">
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            isCancelled ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"
          }`}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {!isCancelled && (
        <ol className="mb-6 flex flex-col gap-2">
          {ORDER_STATUS_FLOW.map((status, i) => (
            <li key={status} className="flex items-center gap-3 text-sm">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  i <= currentStepIndex ? "bg-blue-700" : "bg-neutral-300"
                }`}
              />
              <span className={i <= currentStepIndex ? "text-neutral-900" : "text-neutral-400"}>
                {ORDER_STATUS_LABELS[status]}
              </span>
            </li>
          ))}
        </ol>
      )}

      {order.delivery_otp && !["delivered", "cancelled"].includes(order.status) && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="text-sm text-neutral-600">Share this OTP with your rider on arrival</p>
          <p className="text-2xl font-bold tracking-widest text-blue-700">{order.delivery_otp}</p>
        </div>
      )}

      {order.delivery_assignments?.delivery_partners?.profiles && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">Rider</p>
          <p className="font-medium">
            {order.delivery_assignments.delivery_partners.profiles.full_name}
          </p>
          {order.delivery_assignments.delivery_partners.profiles.phone && (
            <p className="text-sm text-neutral-500">
              {order.delivery_assignments.delivery_partners.profiles.phone}
            </p>
          )}
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
          <span className="text-neutral-500">Subtotal</span>
          <span>{formatSAR(order.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Delivery fee</span>
          <span>{order.delivery_fee === 0 ? "Free" : formatSAR(order.delivery_fee)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">VAT</span>
          <span>{formatSAR(order.vat)}</span>
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
