import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatSAR, ORDER_STATUS_LABELS } from "@/lib/utils";

export default async function RiderHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assignments } = await supabase
    .from("delivery_assignments")
    .select("order_id, orders(id, order_number, status, total, addresses(address_line))")
    .eq("rider_id", user!.id)
    .order("assigned_at", { ascending: false });

  const active = (assignments ?? []).filter(
    (a) => a.orders && !["delivered", "cancelled"].includes((a.orders as unknown as { status: string }).status)
  );

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Assigned Orders</h1>

      {active.length === 0 ? (
        <p className="text-sm text-neutral-500">No active deliveries right now.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((a) => {
            const order = a.orders as unknown as {
              id: string;
              order_number: string;
              status: string;
              total: number;
              addresses: { address_line: string } | null;
            };
            return (
              <Link
                key={order.id}
                href={`/rider/orders/${order.id}`}
                className="rounded-xl border border-neutral-200 bg-white p-4 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">#{order.order_number}</p>
                  <span className="text-sm text-emerald-600">
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <p className="text-sm text-neutral-500">{order.addresses?.address_line}</p>
                <p className="text-sm font-medium">{formatSAR(order.total)}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
