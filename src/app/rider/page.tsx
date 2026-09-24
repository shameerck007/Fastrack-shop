import Link from "next/link";
import { getRiderProfile, getAvailableOrders, getActiveDelivery } from "@/lib/rider";
import { formatSAR, ORDER_STATUS_LABELS } from "@/lib/utils";
import AcceptOrderButton from "@/components/rider/AcceptOrderButton";

export default async function RiderHomePage() {
  const rider = await getRiderProfile();
  const activeDelivery = await getActiveDelivery();
  const availableOrders = rider?.deliveryPartner.is_available && !activeDelivery
    ? await getAvailableOrders()
    : [];

  if (!rider?.deliveryPartner.is_available) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
        <span className="text-4xl">😴</span>
        <p className="font-medium">You&apos;re offline</p>
        <p className="text-sm text-neutral-500">Go online from the header to start receiving orders.</p>
      </div>
    );
  }

  if (activeDelivery) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold">Active Delivery</h1>
        <Link
          href={`/rider/orders/${activeDelivery.id}`}
          className="block rounded-2xl border border-emerald-200 bg-emerald-50 p-4 hover:shadow-sm"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">#{activeDelivery.order_number}</p>
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
              {ORDER_STATUS_LABELS[activeDelivery.status]}
            </span>
          </div>
          {activeDelivery.warehouses && (
            <p className="text-sm text-neutral-600">📍 Pickup: {activeDelivery.warehouses.name}</p>
          )}
          {activeDelivery.addresses && (
            <p className="text-sm text-neutral-600">🏠 Drop: {activeDelivery.addresses.address_line}</p>
          )}
          <p className="mt-2 text-sm font-semibold text-emerald-700">
            Earnings: {formatSAR(activeDelivery.delivery_fee)}
          </p>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Nearby Orders</h1>
      {availableOrders.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
          No orders available right now. New requests will show up here.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {availableOrders.map((order) => (
            <AvailableOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function AvailableOrderCard({
  order,
}: {
  order: Awaited<ReturnType<typeof getAvailableOrders>>[number];
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">#{order.order_number}</p>
          <p className="text-sm text-neutral-500">
            {order.item_count} item{order.item_count === 1 ? "" : "s"} · {order.delivery_type}
          </p>
          {order.warehouses && (
            <p className="mt-1 text-sm text-neutral-600">📍 {order.warehouses.name}</p>
          )}
        </div>
        <div className="text-right">
          <p className="mb-1 font-semibold text-emerald-700">{formatSAR(order.delivery_fee)}</p>
          <AcceptOrderButton orderId={order.id} />
        </div>
      </div>
    </div>
  );
}
