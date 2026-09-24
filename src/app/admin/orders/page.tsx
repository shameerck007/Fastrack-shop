import { createClient } from "@/lib/supabase/server";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import { formatSAR } from "@/lib/utils";
import type { Order } from "@/types/database";

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Orders</h1>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {((orders as Order[]) ?? []).map((order) => (
              <tr key={order.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium">#{order.order_number}</td>
                <td className="px-4 py-2 text-neutral-500">
                  {new Date(order.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">{formatSAR(order.total)}</td>
                <td className="px-4 py-2">
                  <OrderStatusSelect orderId={order.id} status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
