import { formatSAR } from "@/lib/utils";
import type { SettlementOrderRow, SettlementPayout, SettlementSummary } from "@/lib/settlements";
import type { Locale } from "@/lib/i18n/config";

type T = (key: string, vars?: Record<string, string | number>) => string;

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

export function SettlementSummaryCards({ summary, t }: { summary: SettlementSummary; t: T }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <SummaryCard label={t("merchant.gross_sales_delivered")} value={formatSAR(summary.grossSales)} />
      <SummaryCard label={t("merchant.commission_pct", { rate: summary.commissionRate })} value={formatSAR(summary.commissionAmount)} />
      <SummaryCard label={t("merchant.net_earned")} value={formatSAR(summary.netEarned)} tone="emerald" />
      <SummaryCard label={t("merchant.paid_out")} value={formatSAR(summary.paidOut)} />
      <SummaryCard
        label={t("merchant.balance_due")}
        value={formatSAR(summary.balanceDue)}
        tone={summary.balanceDue > 0.005 ? "amber" : "emerald"}
      />
    </div>
  );
}

export function SettlementOrdersTable({ orders, t, locale }: { orders: SettlementOrderRow[]; t: T; locale: Locale }) {
  if (orders.length === 0) {
    return <p className="p-4 text-sm text-neutral-400">{t("merchant.no_delivered_orders")}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
            <th className="px-4 py-2.5">{t("merchant.order_th")}</th>
            <th className="px-3 py-2.5">{t("merchant.delivered_th")}</th>
            <th className="px-3 py-2.5 text-right">{t("merchant.items_th")}</th>
            <th className="px-3 py-2.5 text-right">{t("merchant.sale_total_th")}</th>
            <th className="px-3 py-2.5 text-right">{t("merchant.commission_th")}</th>
            <th className="px-4 py-2.5 text-right">{t("merchant.net_th")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {orders.map((o) => (
            <tr key={o.orderId}>
              <td className="px-4 py-2.5 font-medium text-neutral-800">{o.orderNumber}</td>
              <td className="px-3 py-2.5 text-neutral-500">
                {o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US") : "—"}
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

export function SettlementPayoutsList({ payouts, t, locale }: { payouts: SettlementPayout[]; t: T; locale: Locale }) {
  if (payouts.length === 0) {
    return <p className="p-4 text-sm text-neutral-400">{t("merchant.no_payouts")}</p>;
  }
  const methodLabel = (method: string) =>
    method === "bank_transfer" || method === "cheque" || method === "cash" || method === "other"
      ? t(`merchant.${method}`)
      : method;
  return (
    <ul className="divide-y divide-neutral-100">
      {payouts.map((p) => (
        <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-neutral-900">{formatSAR(p.amount)}</p>
            <p className="text-xs text-neutral-500">
              {methodLabel(p.method)}
              {p.reference && ` ${t("merchant.ref", { ref: p.reference })}`}
            </p>
            {p.note && <p className="mt-0.5 text-xs text-neutral-400">{p.note}</p>}
          </div>
          <span className="shrink-0 text-xs text-neutral-400">
            {new Date(p.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
          </span>
        </li>
      ))}
    </ul>
  );
}
