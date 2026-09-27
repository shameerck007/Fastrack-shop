import Link from "next/link";
import type { AdminQueueOrder } from "@/lib/admin-orders";
import { formatSAR, ORDER_STATUS_LABELS } from "@/lib/utils";
import FulfillmentBadge from "@/components/admin/FulfillmentBadge";

// Same active-pipeline order as ORDER_STATUS_FLOW, minus "delivered" — one
// column per stage, an ops team works the board left to right.
const COLUMNS = ["pending", "confirmed", "preparing", "ready_for_pickup", "rider_assigned", "out_for_delivery"] as const;

const COLUMN_ICON: Record<(typeof COLUMNS)[number], string> = {
  pending: "🆕",
  confirmed: "📋",
  preparing: "👨‍🍳",
  ready_for_pickup: "📦",
  rider_assigned: "🧑‍✈️",
  out_for_delivery: "🛵",
};

function elapsed(createdAt: string): { label: string; tone: "ok" | "warn" | "late" } {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
  const label = minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  const tone = minutes < 15 ? "ok" : minutes < 30 ? "warn" : "late";
  return { label, tone };
}

const TONE_CLASS: Record<"ok" | "warn" | "late", string> = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  late: "bg-red-50 text-red-700",
};

export default function OrdersQueueBoard({ orders }: { orders: AdminQueueOrder[] }) {
  const byColumn = new Map<string, AdminQueueOrder[]>();
  for (const col of COLUMNS) byColumn.set(col, []);
  for (const order of orders) {
    (byColumn.get(order.status) ?? byColumn.get("pending")!).push(order);
  }

  return (
    <div className="mb-5 overflow-x-auto">
      <div className="grid auto-cols-[15rem] grid-flow-col gap-3">
        {COLUMNS.map((status) => {
          const columnOrders = byColumn.get(status) ?? [];
          return (
            <div key={status} className="flex flex-col rounded-2xl border border-neutral-200 bg-neutral-50">
              <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
                  <span aria-hidden>{COLUMN_ICON[status]}</span>
                  {ORDER_STATUS_LABELS[status]}
                </span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1.5 text-[11px] font-bold text-white">
                  {columnOrders.length}
                </span>
              </div>

              <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto p-2">
                {columnOrders.length === 0 ? (
                  <p className="p-3 text-center text-xs text-neutral-400">Empty</p>
                ) : (
                  columnOrders.map((order) => {
                    const e = elapsed(order.created_at);
                    return (
                      <Link
                        key={order.id}
                        href={`/admin/orders/${order.id}`}
                        className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-white p-2.5 text-xs shadow-sm transition hover:border-blue-300 hover:shadow"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-neutral-900">#{order.order_number}</span>
                          <span className={`rounded-full px-1.5 py-0.5 font-medium ${TONE_CLASS[e.tone]}`}>{e.label}</span>
                        </div>
                        <p className="truncate text-neutral-600">{order.customer_name ?? "Guest"}</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-neutral-400">
                            {order.item_count} item{order.item_count === 1 ? "" : "s"}
                          </span>
                          <span className="font-medium text-neutral-900">{formatSAR(order.total)}</span>
                        </div>
                        <FulfillmentBadge fulfillment={order.fulfillment} />
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
