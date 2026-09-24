import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeliveryActions from "@/components/rider/DeliveryActions";
import { formatSAR } from "@/lib/utils";

export default async function RiderOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*), addresses(address_line)")
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Order #{order.order_number}</h1>
      <p className="mb-4 text-sm text-neutral-500">{order.addresses?.address_line}</p>

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

      <p className="mb-4 text-right font-semibold">Total: {formatSAR(order.total)}</p>

      <DeliveryActions orderId={order.id} status={order.status} />
    </div>
  );
}
