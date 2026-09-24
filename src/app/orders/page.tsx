import Link from "next/link";
import { getMyOrders } from "@/lib/orders";
import { formatSAR, ORDER_STATUS_LABELS } from "@/lib/utils";

export default async function OrdersPage() {
  const orders = await getMyOrders();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Your Orders</h1>

      {orders.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No orders yet. <Link href="/" className="text-blue-600 hover:underline">Start shopping</Link>.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 hover:shadow-sm"
            >
              <div>
                <p className="font-medium">Order #{order.order_number}</p>
                <p className="text-sm text-neutral-500">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatSAR(order.total)}</p>
                <p className="text-sm text-blue-600">{ORDER_STATUS_LABELS[order.status]}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
