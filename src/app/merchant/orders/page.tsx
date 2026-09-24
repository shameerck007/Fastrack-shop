import { getMyStoreOrders } from "@/lib/merchant";
import { formatSAR } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  confirmed: "bg-blue-50 text-blue-700",
  preparing: "bg-blue-50 text-blue-700",
  ready_for_pickup: "bg-amber-50 text-amber-700",
  rider_assigned: "bg-amber-50 text-amber-700",
  out_for_delivery: "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default async function MerchantOrdersPage() {
  const orders = await getMyStoreOrders();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Orders</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Orders containing your products. Fulfillment (packing, delivery) is handled by FasTrack.
      </p>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No orders yet — once a customer buys one of your products, it&apos;ll show up here.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <div key={order.orderId} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">#{order.orderNumber}</p>
                  <p className="text-xs text-neutral-400">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                    STATUS_STYLES[order.status] ?? "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {statusLabel(order.status)}
                </span>
              </div>

              <div className="flex flex-col divide-y divide-neutral-100 border-t border-neutral-100 text-sm">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2">
                    <div>
                      <p>{item.product_name}</p>
                      <p className="text-xs text-neutral-400">
                        {item.variant_label} × {item.ordered_quantity}
                      </p>
                    </div>
                    <span className="text-neutral-700">{formatSAR(item.line_total)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex justify-end border-t border-neutral-100 pt-2 text-sm font-medium">
                Your items: {formatSAR(order.total)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
