"use client";

import { useState } from "react";
import Link from "next/link";

import type { AdminSettlementOverviewRow } from "@/lib/settlements";
import { useLocale } from "@/components/LocaleProvider";
import { useMoney } from "@/components/MoneyProvider";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

export default function SettlementsList({ rows }: { rows: AdminSettlementOverviewRow[] }) {
  const money = useMoney();
  const [q, setQ] = useState("");
  const { t } = useLocale();

  const filtered = rows.filter((r) => r.storeName.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-neutral-700">{t("settlements_list.suppliers")}</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("settlements_list.search_supplier")}
          className="w-48 rounded-full border border-neutral-300 px-3 py-1 text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="p-6 text-sm text-neutral-500">
          {rows.length === 0 ? t("settlements_list.no_suppliers_yet") : t("settlements_list.no_suppliers_match")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                <th className="px-5 py-2.5">{t("settlements_list.supplier_th")}</th>
                <th className="px-3 py-2.5 text-right">{t("settlements_list.gross_sales_th")}</th>
                <th className="px-3 py-2.5 text-right">{t("settlements_list.commission_th")}</th>
                <th className="px-3 py-2.5 text-right">{t("settlements_list.net_earned_th")}</th>
                <th className="px-3 py-2.5 text-right">{t("settlements_list.paid_out_th")}</th>
                <th className="px-3 py-2.5 text-right">{t("settlements_list.balance_due_th")}</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((r) => (
                <tr key={r.storeId} className="transition hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/settlements/${r.storeId}`} className="font-medium text-neutral-900 hover:text-blue-600">
                      {r.storeName}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[r.storeStatus] ?? "bg-neutral-100"}`}>
                        {r.storeStatus}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {t("settlements_list.delivered_orders_count", { count: r.deliveredOrderCount })}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-neutral-700">{money(r.grossSales)}</td>
                  <td className="px-3 py-3 text-right text-neutral-500">
                    {money(r.commissionAmount)} <span className="text-xs">({r.commissionRate}%)</span>
                  </td>
                  <td className="px-3 py-3 text-right text-neutral-700">{money(r.netEarned)}</td>
                  <td className="px-3 py-3 text-right text-neutral-700">{money(r.paidOut)}</td>
                  <td className={`px-3 py-3 text-right font-semibold ${r.balanceDue > 0.005 ? "text-amber-700" : "text-emerald-700"}`}>
                    {money(r.balanceDue)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/settlements/${r.storeId}`} className="text-xs font-medium text-blue-600 hover:underline">
                      {t("settlements_list.ledger")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
