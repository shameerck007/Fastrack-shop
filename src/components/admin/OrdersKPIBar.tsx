import { formatSAR } from "@/lib/utils";
import type { AdminOrderKPIs } from "@/lib/admin-orders";

function Kpi({ icon, label, value, accent, urgent }: { icon: string; label: string; value: string | number; accent: string; urgent?: boolean }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm ${
        urgent ? "border-red-200 ring-1 ring-red-100" : "border-neutral-200"
      }`}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ background: `${accent}1a`, color: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p className="text-2xl font-semibold leading-tight text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

export default function OrdersKPIBar({ kpis }: { kpis: AdminOrderKPIs }) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Live queue — needs action now
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon="🆕" label="New orders" value={kpis.queue.pending} accent="#dc2626" urgent={kpis.queue.pending > 0} />
          <Kpi icon="👨‍🍳" label="Preparing" value={kpis.queue.confirmedPreparing} accent="#d97706" />
          <Kpi icon="📦" label="Ready for pickup" value={kpis.queue.readyForPickup} accent="#2563eb" />
          <Kpi icon="🛵" label="Out for delivery" value={kpis.queue.outForDelivery} accent="#7c3aed" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Today</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon="🧾" label="Orders today" value={kpis.today.totalOrders} accent="#0891b2" />
          <Kpi icon="✅" label="Delivered today" value={kpis.today.delivered} accent="#059669" />
          <Kpi icon="✕" label="Cancelled today" value={kpis.today.cancelled} accent="#64748b" />
          <Kpi icon="💰" label="Revenue today" value={formatSAR(kpis.today.revenue)} accent="#2563eb" />
        </div>
      </div>
    </div>
  );
}
