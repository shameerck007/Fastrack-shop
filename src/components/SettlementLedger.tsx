import { formatSAR } from "@/lib/utils";
import type { SettlementOrderRow, SettlementPayout, SettlementSummary } from "@/lib/settlements";

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" | "neutral" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-neutral-900";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
    </div>
  );
}

export function SettlementSummaryCards({ summary }: { summary: SettlementSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <SummaryCard label="Gross sales (delivered)" value={formatSAR(summary.grossSales)} />
      <SummaryCard label={`Commission (${summary.commissionRate}%)`} value={formatSAR(summary.commissionAmount)} />
      <SummaryCard label="Net earned" value={formatSAR(summary.netEarned)} tone="emerald" />
      <SummaryCard label="Paid out" value={formatSAR(summary.paidOut)} />
      <SummaryCard
        label="Balance due"
        value={formatSAR(summary.balanceDue)}
        tone={summary.balanceDue > 0.005 ? "amber" : "emerald"}
      />
    </div>
  );
}

export function SettlementOrdersTable({ orders }: { orders: SettlementOrderRow[] }) {
  if (orders.length === 0) {
    return <p className="p-4 text-sm text-neutral-400">No delivered orders yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
            <th className="px-4 py-2.5">Order</th>
            <th className="px-3 py-2.5">Delivered</th>
            <th className="px-3 py-2.5 text-right">Items</th>
            <th className="px-3 py-2.5 text-right">Sale total</th>
            <th className="px-3 py-2.5 text-right">Commission</th>
            <th className="px-4 py-2.5 text-right">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {orders.map((o) => (
            <tr key={o.orderId}>
              <td className="px-4 py-2.5 font-medium text-neutral-800">{o.orderNumber}</td>
              <td className="px-3 py-2.5 text-neutral-500">
                {o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString() : "—"}
              </td>
              <td className="px-3 py-2.5 text-right text-neutral-500">{o.itemCount}</td>
              <td className="px-3 py-2.5 text-right text-neutral-700">{formatSAR(o.lineTotal)}</td>
              <td className="px-3 py-2.5 text-right text-neutral-500">{formatSAR(o.commissionAmount)}</td>
              <td className="px-4 py-2.5 text-right font-medium text-neutral-900">{formatSAR(o.netAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  cash: "Cash",
  other: "Other",
};

export function SettlementPayoutsList({ payouts }: { payouts: SettlementPayout[] }) {
  if (payouts.length === 0) {
    return <p className="p-4 text-sm text-neutral-400">No payouts recorded yet.</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100">
      {payouts.map((p) => (
        <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-neutral-900">{formatSAR(p.amount)}</p>
            <p className="text-xs text-neutral-500">
              {METHOD_LABEL[p.method] ?? p.method}
              {p.reference && ` · Ref: ${p.reference}`}
            </p>
            {p.note && <p className="mt-0.5 text-xs text-neutral-400">{p.note}</p>}
          </div>
          <span className="shrink-0 text-xs text-neutral-400">{new Date(p.createdAt).toLocaleDateString()}</span>
        </li>
      ))}
    </ul>
  );
}
