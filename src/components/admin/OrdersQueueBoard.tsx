import Link from "@/components/Link";
import type { MoneyFormatter } from "@/lib/money";
import type { AdminQueueOrder } from "@/lib/admin-orders";

import FulfillmentBadge from "@/components/admin/FulfillmentBadge";
import { getMoney } from "@/lib/tenant-server";

// Same active-pipeline order as ORDER_STATUS_FLOW, minus "delivered" — one
// column per stage, an ops team works the board left to right.
const COLUMNS = ["pending", "confirmed", "preparing", "ready_for_pickup", "rider_assigned", "out_for_delivery"] as const;

const COLUMN_STYLE: Record<(typeof COLUMNS)[number], { icon: string; accent: string }> = {
  pending: { icon: "🆕", accent: "#dc2626" },
  confirmed: { icon: "📋", accent: "#d97706" },
  preparing: { icon: "👨‍🍳", accent: "#d97706" },
  ready_for_pickup: { icon: "📦", accent: "#2563eb" },
  rider_assigned: { icon: "🧑‍✈️", accent: "#7c3aed" },
  out_for_delivery: { icon: "🛵", accent: "#7c3aed" },
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

export default function OrdersQueueBoard({
  orders,
  t,
  money,
}: {
  money: MoneyFormatter;
  orders: AdminQueueOrder[];
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const byColumn = new Map<string, AdminQueueOrder[]>();
  for (const col of COLUMNS) byColumn.set(col, []);
  for (const order of orders) {
    (byColumn.get(order.status) ?? byColumn.get("pending")!).push(order);
  }

  return (
    <div className="mb-5 min-w-0 overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="grid auto-cols-[13rem] grid-flow-col gap-2.5">
        {COLUMNS.map((status) => {
          const columnOrders = byColumn.get(status) ?? [];
          const { icon, accent } = COLUMN_STYLE[status];
          return (
            <div key={status} className="flex flex-col overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50/70">
              <div className="flex items-center justify-between gap-2 border-b-2 bg-white px-2.5 py-2" style={{ borderBottomColor: accent }}>
                <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-semibold text-neutral-800">
                  <span aria-hidden>{icon}</span>
                  <span className="truncate">{t(`order_status.${status}`)}</span>
                </span>
                <span
                  className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
                  style={{ background: accent }}
                >
                  {columnOrders.length}
                </span>
              </div>

              <div className="flex max-h-[30rem] flex-col gap-2 overflow-y-auto p-2">
                {columnOrders.length === 0 ? (
                  <p className="p-3 text-center text-xs text-neutral-400">{t("admin.empty")}</p>
                ) : (
                  columnOrders.map((order) => {
                    const e = elapsed(order.created_at);
                    return (
                      <Link
                        key={order.id}
                        href={`/admin/orders/${order.id}`}
                        className="flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-white p-2 text-xs shadow-sm transition hover:border-blue-300 hover:shadow"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-neutral-900">#{order.order_number}</span>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 font-medium ${TONE_CLASS[e.tone]}`}>{e.label}</span>
                        </div>
                        <p className="truncate text-neutral-600">{order.customer_name ?? t("admin.guest")}</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-neutral-400">
                            {t("admin.item_count", { count: order.item_count, plural: order.item_count === 1 ? "" : "s" })}
                          </span>
                          <span className="shrink-0 font-medium text-neutral-900">{money(order.total)}</span>
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
