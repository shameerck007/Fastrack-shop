import { formatSAR } from "@/lib/utils";
import type { AdminOrderKPIs } from "@/lib/admin-orders";

function Kpi({ icon, label, value, accent, urgent }: { icon: string; label: string; value: string | number; accent: string; urgent?: boolean }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 shadow-sm ${
        urgent ? "border-red-200 ring-1 ring-red-100" : "border-neutral-200"
      }`}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
        style={{ background: `${accent}1a`, color: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-neutral-500">{label}</p>
        <p className="text-lg font-semibold leading-tight text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

export default function OrdersKPIBar({ kpis }: { kpis: AdminOrderKPIs }) {
  return (
    <div className="mb-5 flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi icon="🆕" label="New orders" value={kpis.queue.pending} accent="#dc2626" urgent={kpis.queue.pending > 0} />
        <Kpi icon="👨‍🍳" label="Preparing" value={kpis.queue.confirmedPreparing} accent="#d97706" />
        <Kpi icon="📦" label="Ready for pickup" value={kpis.queue.readyForPickup} accent="#2563eb" />
        <Kpi icon="🛵" label="Out for delivery" value={kpis.queue.outForDelivery} accent="#7c3aed" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi icon="🧾" label="Orders today" value={kpis.today.totalOrders} accent="#0891b2" />
        <Kpi icon="✅" label="Delivered today" value={kpis.today.delivered} accent="#059669" />
        <Kpi icon="✕" label="Cancelled today" value={kpis.today.cancelled} accent="#64748b" />
        <Kpi icon="💰" label="Revenue today" value={formatSAR(kpis.today.revenue)} accent="#2563eb" />
      </div>
    </div>
  );
}
