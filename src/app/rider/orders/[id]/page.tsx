import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeliveryActions from "@/components/rider/DeliveryActions";
import { formatSAR } from "@/lib/utils";

function mapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default async function RiderOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "*, order_items(*), addresses(address_line), warehouses(name, address_line), profiles(full_name, phone)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const isPickupStage = ["rider_assigned", "ready_for_pickup", "preparing"].includes(order.status);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Order #{order.order_number}</h1>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          {formatSAR(order.delivery_fee)}
        </span>
      </div>

      {order.warehouses && (
        <div
          className={`mb-3 rounded-xl border p-4 ${
            isPickupStage ? "border-emerald-300 bg-emerald-50" : "border-neutral-200 bg-white"
          }`}
        >
          <p className="text-xs font-medium uppercase text-neutral-500">Pickup</p>
          <p className="font-medium">{order.warehouses.name}</p>
          {order.warehouses.address_line && (
            <p className="text-sm text-neutral-600">{order.warehouses.address_line}</p>
          )}
          <a
            href={mapsUrl(order.warehouses.address_line ?? order.warehouses.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-emerald-700 hover:underline"
          >
            Navigate to store →
          </a>
        </div>
      )}

      {order.addresses && (
        <div
          className={`mb-4 rounded-xl border p-4 ${
            !isPickupStage ? "border-emerald-300 bg-emerald-50" : "border-neutral-200 bg-white"
          }`}
        >
          <p className="text-xs font-medium uppercase text-neutral-500">Drop-off</p>
          <p className="font-medium capitalize">{order.addresses.label}</p>
          <p className="text-sm text-neutral-600">{order.addresses.address_line}</p>
          <div className="mt-2 flex gap-4">
            <a
              href={mapsUrl(order.addresses.address_line)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-700 hover:underline"
            >
              Navigate to customer →
            </a>
            {order.profiles?.phone && (
              <a href={`tel:${order.profiles.phone}`} className="text-sm font-medium text-emerald-700 hover:underline">
                Call customer
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white">
        {order.order_items.map((item: { id: string; product_name: string; variant_label: string; ordered_quantity: number; line_total: number }) => (
          <div key={item.id} className="flex items-center justify-between border-b border-neutral-100 p-3 last:border-none text-sm">
            <span>
              {item.product_name} — {item.variant_label} × {item.ordered_quantity}
            </span>
            <span>{formatSAR(item.line_total)}</span>
          </div>
        ))}
      </div>

      <p className="mb-4 text-right font-semibold">Order total: {formatSAR(order.total)}</p>

      <DeliveryActions orderId={order.id} status={order.status} />
    </div>
  );
}
