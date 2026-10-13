"use client";

import { useMemo, useState } from "react";
import Link from "@/components/Link";
import { useMoney } from "@/components/MoneyProvider";
import { errorText, unwrapAction } from "@/lib/errors";
import { exportPayoutSheet } from "@/lib/actions/admin-settlements";
import { buildXlsx } from "@/lib/xlsx-lite";
import { downloadXlsx } from "@/lib/product-template";
import type { AdminSettlementOverviewRow, MonthlyPoint } from "@/lib/settlements";
import SettlementChart from "@/components/settlement/SettlementChart";
import PortalPageHeader from "@/components/ui/PortalPageHeader";
import RecordPayoutForm from "@/components/admin/RecordPayoutForm";
import { BRAND } from "@/lib/brand";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

type Sort = "balance" | "net" | "sales" | "name";

function Tile({ icon, label, value, accent, hint }: { icon: string; label: string; value: string | number; accent: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: `${accent}1a`, color: accent }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p className="break-words text-lg font-bold leading-tight text-neutral-900 sm:text-xl">{value}</p>
        {hint && <p className="text-[11px] text-neutral-500">{hint}</p>}
      </div>
    </div>
  );
}

export default function AdminSettlementsOverview({ rows, monthly }: { rows: AdminSettlementOverviewRow[]; monthly: MonthlyPoint[] | null }) {
  const money = useMoney();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [owedOnly, setOwedOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("balance");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => {
    const t = { gross: 0, commission: 0, net: 0, paid: 0, due: 0, owed: 0, refunds: 0 };
    for (const r of rows) {
      t.gross += r.grossSales;
      t.commission += r.commissionAmount;
      t.net += r.netEarned;
      t.paid += r.paidOut;
      t.due += r.balanceDue;
      t.refunds += r.refunds;
      if (r.balanceDue > 0.005) t.owed++;
    }
    return t;
  }, [rows]);

  const shown = useMemo(() => {
    const list = rows.filter(
      (r) => (!q.trim() || r.storeName.toLowerCase().includes(q.trim().toLowerCase())) && (status === "all" || r.storeStatus === status) && (!owedOnly || r.balanceDue > 0.005),
    );
    const by: Record<Sort, (a: AdminSettlementOverviewRow, b: AdminSettlementOverviewRow) => number> = {
      balance: (a, b) => b.balanceDue - a.balanceDue,
      net: (a, b) => b.netEarned - a.netEarned,
      sales: (a, b) => b.grossSales - a.grossSales,
      name: (a, b) => a.storeName.localeCompare(b.storeName),
    };
    return [...list].sort(by[sort]);
  }, [rows, q, status, owedOnly, sort]);

  const maxDue = Math.max(0.01, ...rows.map((r) => r.balanceDue));

  function exportOverview() {
    const header = ["Supplier", "Status", "Delivered orders", "Sales", "Refunds", "Commission", "Commission %", "Net earned", "Paid out", "Balance due"];
    downloadXlsx(
      buildXlsx([
        {
          name: "Suppliers",
          rows: [header, ...shown.map((r) => [r.storeName, r.storeStatus, r.deliveredOrderCount, r.grossSales, r.refunds, r.commissionAmount, r.commissionRate, r.netEarned, r.paidOut, r.balanceDue])],
          widths: [28, 12, 16, 12, 12, 12, 14, 12, 12, 14],
        },
      ]),
      "settlements-overview.xlsx",
    );
  }

  async function payoutSheet() {
    setBusy(true);
    setErr(null);
    try {
      const sheet = await unwrapAction(exportPayoutSheet)();
      if (sheet.length === 0) {
        setErr("No supplier is owed money right now.");
      } else {
        const header = ["Supplier", "Amount to pay", "Account holder", "Bank", "IBAN / account number", "IFSC", "Phone"];
        downloadXlsx(
          buildXlsx([
            {
              name: "Payouts to make",
              rows: [header, ...sheet.map((r) => [r.supplier, r.balanceDue, r.holder, r.bank, r.account, r.ifsc, r.phone]), ["Total", sheet.reduce((s, r) => s + r.balanceDue, 0), "", "", "", "", ""]],
              widths: [28, 16, 24, 22, 30, 14, 16],
            },
          ]),
          "payouts-to-make.xlsx",
        );
      }
    } catch (e) {
      setErr(errorText(e, "Could not prepare the payout sheet."));
    }
    setBusy(false);
  }

  const btn = "h-10 rounded-full border border-neutral-300 px-4 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50";
  const field = "h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  return (
    <div className="flex flex-col gap-5">
      <PortalPageHeader
        icon="📒"
        title="Supplier ledger"
        subtitle="What each supplier has sold, what FasTrack kept, what was paid, and what is still owed. Open a supplier to see every entry."
        actions={
          <button onClick={payoutSheet} disabled={busy} className="h-10 rounded-full bg-brand-700 px-5 text-sm font-bold text-white transition hover:bg-brand-800 disabled:opacity-60">
            {busy ? "Preparing…" : "⬇ Payouts to make (Excel)"}
          </button>
        }
      />
      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 lg:grid-cols-4">
        <Tile icon="⏳" label="Outstanding balance" value={money(totals.due)} accent="#dc2626" hint={`${totals.owed} supplier${totals.owed === 1 ? "" : "s"} to pay`} />
        <Tile icon="💰" label="Net earned (all time)" value={money(totals.net)} accent={BRAND[600]} hint={`on ${money(totals.gross)} sales`} />
        <Tile icon="✅" label="Paid out (all time)" value={money(totals.paid)} accent="#059669" />
        <Tile icon="🏷️" label="FasTrack commission" value={money(totals.commission)} accent="#7c3aed" hint={totals.refunds > 0 ? `${money(totals.refunds)} refunded` : undefined} />
      </div>

      {monthly && monthly.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <SettlementChart points={monthly} title="All suppliers: earned and paid out by month" />
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-neutral-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-800">
              Suppliers ({shown.length}
              {shown.length !== rows.length ? ` of ${rows.length}` : ""})
            </h2>
            <button onClick={exportOverview} disabled={shown.length === 0} className={btn}>
              Download Excel
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supplier" className={`${field} col-span-2 sm:w-56`} />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={field}>
              <option value="balance">Most owed first</option>
              <option value="net">Highest net earned</option>
              <option value="sales">Highest sales</option>
              <option value="name">Name A–Z</option>
            </select>
            <label className="col-span-2 flex items-center gap-2 text-sm text-neutral-700 sm:col-span-1">
              <input type="checkbox" checked={owedOnly} onChange={(e) => setOwedOnly(e.target.checked)} className="h-4 w-4 accent-brand-700" />
              Only suppliers owed money
            </label>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-neutral-500">{rows.length === 0 ? "No suppliers yet." : "No supplier matches these filters."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                  <th className="px-5 py-2.5">Supplier</th>
                  <th className="px-3 py-2.5 text-right">Sales</th>
                  <th className="px-3 py-2.5 text-right">Commission</th>
                  <th className="px-3 py-2.5 text-right">Net earned</th>
                  <th className="px-3 py-2.5 text-right">Paid out</th>
                  <th className="px-3 py-2.5 text-right">Balance due</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {shown.map((r) => (
                  <tr key={r.storeId} className="transition hover:bg-neutral-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/settlements/${r.storeId}`} className="font-medium text-neutral-900 hover:text-brand-700">
                        {r.storeName}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[r.storeStatus] ?? "bg-neutral-100"}`}>{r.storeStatus}</span>
                        <span className="text-[11px] text-neutral-500">
                          {r.deliveredOrderCount} delivered order{r.deliveredOrderCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-neutral-700">{money(r.grossSales)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-neutral-500">
                      {money(r.commissionAmount)} <span className="text-xs">({r.commissionRate}%)</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-neutral-700">{money(r.netEarned)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-neutral-700">{money(r.paidOut)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`whitespace-nowrap font-semibold ${r.balanceDue > 0.005 ? "text-amber-700" : "text-emerald-700"}`}>{money(r.balanceDue)}</span>
                      {r.balanceDue > 0.005 && (
                        <span className="ml-auto mt-1 block h-1 w-24 overflow-hidden rounded-full bg-neutral-100">
                          <span className="block h-full rounded-full bg-amber-400" style={{ width: `${Math.max(6, (r.balanceDue / maxDue) * 100)}%` }} />
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/settlements/${r.storeId}`} className="text-xs font-semibold text-brand-700 hover:underline">
                          Open →
                        </Link>
                        {r.balanceDue > 0.005 && r.storeStatus === "approved" && (
                          <span className="[&_button]:!h-8 [&_button]:!px-3 [&_button]:!text-xs">
                            <RecordPayoutForm storeId={r.storeId} balanceDue={r.balanceDue} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
