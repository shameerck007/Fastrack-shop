import Link from "next/link";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import FulfillmentBadge from "@/components/admin/FulfillmentBadge";
import OrdersKPIBar from "@/components/admin/OrdersKPIBar";
import OrdersQueueBoard from "@/components/admin/OrdersQueueBoard";
import OrdersLiveRefresher from "@/components/admin/OrdersLiveRefresher";
import { getAdminOrders, getAdminOrdersQueue, getAdminOrderKPIs } from "@/lib/admin-orders";
import { formatSAR, PAYMENT_METHOD_LABELS, DELIVERY_TYPE_LABELS } from "@/lib/utils";

export default async function AdminOrdersPage() {
  const [kpis, queueOrders, orders] = await Promise.all([
    getAdminOrderKPIs(),
    getAdminOrdersQueue(),
    getAdminOrders(50),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Orders</h1>
          <OrdersLiveRefresher />
        </div>
      </div>

      <OrdersKPIBar kpis={kpis} />

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Order queue</p>
      <OrdersQueueBoard orders={queueOrders} />

      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Recent orders</p>
        <p className="text-sm text-neutral-500">{orders.length} most recent</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Items</th>
              <th className="px-4 py-2">Fulfilled by</th>
              <th className="px-4 py-2">Delivery</th>
              <th className="px-4 py-2">Payment</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const payment = order.payments[0];
              const itemCount = order.order_items.reduce((sum, i) => sum + Number(i.ordered_quantity), 0);
              return (
                <tr key={order.id} className="border-t border-neutral-100 align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      #{order.order_number}
                    </Link>
                    <p className="text-xs text-neutral-400">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{order.profiles?.full_name ?? "—"}</p>
                    {order.profiles?.phone && (
                      <p className="text-xs text-neutral-500">{order.profiles.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {order.order_items.length} line{order.order_items.length === 1 ? "" : "s"}
                    <p className="text-xs text-neutral-400">{itemCount} units</p>
                  </td>
                  <td className="px-4 py-3">
                    <FulfillmentBadge fulfillment={order.fulfillment} />
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {DELIVERY_TYPE_LABELS[order.delivery_type] ?? order.delivery_type}
                    {order.addresses && (
                      <p className="text-xs text-neutral-400">
                        {[order.addresses.district, order.addresses.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {payment ? (PAYMENT_METHOD_LABELS[payment.method] ?? payment.method) : "—"}
                    {payment && (
                      <p className="text-xs capitalize text-neutral-400">{payment.status}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatSAR(order.total)}</td>
                  <td className="px-4 py-3">
                    <OrderStatusSelect orderId={order.id} status={order.status} />
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="mt-1 block text-xs text-blue-600 hover:underline"
                    >
                      View details →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
