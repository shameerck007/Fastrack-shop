"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/Link";
import { useMoney } from "@/components/MoneyProvider";
import { buildXlsx } from "@/lib/xlsx-lite";
import { downloadXlsx } from "@/lib/product-template";
import type { LedgerEntry, SettlementOrderRow, SettlementPayout, SettlementSummary } from "@/lib/settlements";
import { monthlyFromLedger } from "@/lib/settlement-ledger-utils";
import SettlementChart from "@/components/settlement/SettlementChart";
import PortalPageHeader from "@/components/ui/PortalPageHeader";

type TabId = "overview" | "ledger" | "orders" | "payouts" | "statements";
type Kind = "all" | "sale" | "refund" | "payout";

const dateFmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const day = (d: string | null) => (d ? d.slice(0, 10) : "");
const methodLabel = (m: string) => (m === "bank_transfer" ? "Bank transfer" : m === "cheque" ? "Cheque" : m === "cash" ? "Cash" : m.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()));

const KIND_STYLE: Record<string, string> = {
  sale: "bg-brand-50 text-brand-700",
  refund: "bg-amber-50 text-amber-700",
  payout: "bg-emerald-50 text-emerald-700",
};
const KIND_LABEL: Record<string, string> = { sale: "Sale", refund: "Refund", payout: "Payout" };

function exportSheet(file: string, sheet: string, header: string[], rows: (string | number | null)[][]) {
  downloadXlsx(buildXlsx([{ name: sheet, rows: [header, ...rows], widths: header.map((h, i) => (i === 0 ? 14 : Math.max(12, h.length + 2))) }]), file);
}

function Tile({ label, value, tone, hint }: { label: string; value: string; tone?: "good" | "warn" | "bad"; hint?: string }) {
  const cls = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-600" : "text-neutral-900";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className={`mt-1 break-words text-lg font-bold leading-tight sm:text-xl ${cls}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>}
    </div>
  );
}

function Panel({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

const field = "h-10 rounded-xl border border-neutral-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const exportBtn = "h-9 rounded-full border border-neutral-300 px-4 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40";

export default function LedgerWorkspace({
  storeId,
  storeName,
  role,
  summary,
  entries,
  orders,
  payouts,
  headerActions,
}: {
  storeId: string;
  storeName: string;
  role: "admin" | "merchant";
  summary: SettlementSummary;
  entries: LedgerEntry[] | null;
  orders: SettlementOrderRow[];
  payouts: SettlementPayout[];
  headerActions?: React.ReactNode;
}) {
  const money = useMoney();
  const [tab, setTab] = useState<TabId>("overview");

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace("#", "") as TabId;
      if (["overview", "ledger", "orders", "payouts", "statements"].includes(h)) setTab(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const pick = (t: TabId) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  const discounts = Math.max(0, Math.round((summary.grossSales - summary.refunds - summary.commissionAmount - summary.netEarned) * 100) / 100);
  const lastPayout = payouts[0];
  const owed = summary.balanceDue > 0.005;
  const monthly = useMemo(() => (entries ? monthlyFromLedger(entries) : []), [entries]);

  /* ----------------------------- ledger tab state ----------------------------- */
  const [kind, setKind] = useState<Kind>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const filteredEntries = useMemo(() => {
    const list = (entries ?? []).filter((e) => (kind === "all" || e.kind === kind) && (!from || day(e.at) >= from) && (!to || day(e.at) <= to) && (!q.trim() || `${e.ref} ${e.description}`.toLowerCase().includes(q.trim().toLowerCase())));
    return newestFirst ? [...list].reverse() : list;
  }, [entries, kind, from, to, q, newestFirst]);
  const filteredSum = filteredEntries.reduce((s, e) => s + e.amount, 0);

  /* ------------------------------ orders tab state ----------------------------- */
  const [oq, setOq] = useState("");
  const [ofrom, setOfrom] = useState("");
  const [oto, setOto] = useState("");
  const filteredOrders = useMemo(() => orders.filter((o) => (!oq.trim() || o.orderNumber.toLowerCase().includes(oq.trim().toLowerCase())) && (!ofrom || day(o.deliveredAt) >= ofrom) && (!oto || day(o.deliveredAt) <= oto)), [orders, oq, ofrom, oto]);
  const oTotals = filteredOrders.reduce((a, o) => ({ sales: a.sales + o.lineTotal, refunded: a.refunded + o.refunded, commission: a.commission + o.commissionAmount, net: a.net + o.netAmount }), { sales: 0, refunded: 0, commission: 0, net: 0 });

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "ledger", label: "Ledger", count: entries?.length },
    { id: "orders", label: "Orders", count: orders.length },
    { id: "payouts", label: "Payouts", count: payouts.length },
    { id: "statements", label: "Statements" },
  ];

  /* ------------------------------ statements tab ------------------------------- */
  const months = useMemo(() => {
    const out: { label: string; from: string; to: string }[] = [];
    const now = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (let i = 0; i < 12; i++) {
      const first = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const last = i === 0 ? now : new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      out.push({ label: first.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), from: iso(first), to: iso(last) });
    }
    return out;
  }, []);
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const link = (f: string, t: string, format: "pdf" | "xlsx") => `/api/settlements/statement?store=${storeId}&from=${f}&to=${t}&format=${format}`;
  const customOk = cFrom && cTo && cTo >= cFrom;

  const who = role === "admin" ? storeName : "you";

  return (
    <div className="flex flex-col gap-5">
      <PortalPageHeader
        icon="📒"
        title={role === "admin" ? storeName : "Supplier ledger"}
        subtitle={role === "admin" ? "Supplier ledger: sales, FasTrack commission, payouts and the balance owed." : "Your sales, FasTrack's commission, payouts and what you are still owed."}
        actions={headerActions}
      />

      {/* balance */}
      <section className={`rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${owed ? "border-amber-200" : "border-emerald-200"}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Balance due</p>
            <p className={`mt-1 break-words text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl ${owed ? "text-amber-700" : "text-emerald-700"}`}>{money(summary.balanceDue)}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {owed ? (role === "admin" ? "FasTrack owes this supplier" : "FasTrack owes you") : summary.balanceDue < -0.005 ? "Overpaid: paid more than earned" : "Nothing owed right now"}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="text-xs text-neutral-500">Delivered orders</dt>
              <dd className="font-semibold text-neutral-900">{summary.deliveredOrderCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Commission</dt>
              <dd className="font-semibold text-neutral-900">{summary.commissionRate}%</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Last payout</dt>
              <dd className="font-semibold text-neutral-900">{lastPayout ? money(lastPayout.amount) : "—"}</dd>
              {lastPayout && <dd className="text-[11px] text-neutral-500">{dateFmt(lastPayout.createdAt)}</dd>}
            </div>
          </dl>
        </div>
      </section>

      {/* tabs */}
      <div role="tablist" className="-mx-4 flex gap-1 overflow-x-auto border-b border-neutral-200 px-4 [scrollbar-width:none] md:mx-0 md:px-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => pick(t.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? "border-brand-700 text-brand-800" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}
          >
            {t.label}
            {t.count !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === t.id ? "bg-brand-100 text-brand-800" : "bg-neutral-100 text-neutral-500"}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ------------------------------- OVERVIEW ------------------------------ */}
      {tab === "overview" && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 lg:grid-cols-4">
            <Tile label="Sales (delivered)" value={money(summary.grossSales)} hint={`incl. ${money(summary.taxInside)} tax`} />
            <Tile label="Refunds" value={summary.refunds > 0 ? `−${money(summary.refunds)}` : money(0)} tone={summary.refunds > 0 ? "warn" : undefined} />
            <Tile label={`Commission (${summary.commissionRate}%)`} value={`−${money(summary.commissionAmount)}`} />
            <Tile label="Net earned" value={money(summary.netEarned)} tone="good" />
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <div className="min-w-0 lg:col-span-3">
              <Panel title="Earned and paid out by month">
                <div className="p-4">{entries ? <SettlementChart points={monthly} title="" /> : <p className="py-6 text-center text-sm text-neutral-500">The monthly chart needs the latest database update.</p>}</div>
              </Panel>
            </div>
            <div className="min-w-0 lg:col-span-2">
              <Panel title="How the balance adds up">
                <dl className="divide-y divide-neutral-100 px-4 text-sm">
                  {[
                    ["Sales", money(summary.grossSales), ""],
                    ["Refunds", `−${money(summary.refunds)}`, "text-amber-700"],
                    ["FasTrack commission", `−${money(summary.commissionAmount)}`, ""],
                    ...(discounts > 0 ? [[`Discounts ${who === "you" ? "you" : "the supplier"} funded`, `−${money(discounts)}`, ""]] : []),
                  ].map(([k, v, c]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3 py-2.5">
                      <dt className="text-neutral-600">{k}</dt>
                      <dd className={`font-medium ${c || "text-neutral-900"}`}>{v}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-3 py-2.5 font-semibold">
                    <dt className="text-neutral-900">Net earned</dt>
                    <dd className="text-emerald-700">{money(summary.netEarned)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-neutral-600">Paid out</dt>
                    <dd className="font-medium text-neutral-900">−{money(summary.paidOut)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 bg-neutral-50 py-3 font-bold">
                    <dt className="text-neutral-900">Balance due</dt>
                    <dd className={owed ? "text-amber-700" : "text-emerald-700"}>{money(summary.balanceDue)}</dd>
                  </div>
                </dl>
              </Panel>
            </div>
          </div>

          <Panel
            title="Recent activity"
            actions={
              entries && entries.length > 0 ? (
                <button onClick={() => pick("ledger")} className="text-xs font-semibold text-brand-700 hover:underline">
                  See the full ledger →
                </button>
              ) : undefined
            }
          >
            {!entries || entries.length === 0 ? (
              <p className="p-5 text-sm text-neutral-500">{entries ? "No activity yet. Delivered orders and payouts will appear here." : "The ledger needs the latest database update."}</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {[...entries].reverse().slice(0, 6).map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${KIND_STYLE[e.kind]}`}>{KIND_LABEL[e.kind]}</span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900">{e.kind === "payout" ? e.description : `Order ${e.ref}`}</p>
                        <p className="text-xs text-neutral-500">{dateFmt(e.at)}{e.kind === "payout" && e.ref ? ` · Ref ${e.ref}` : e.kind !== "payout" ? ` · ${e.description}` : ""}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 font-semibold ${e.amount < 0 ? "text-neutral-700" : "text-emerald-700"}`}>{e.amount < 0 ? "−" : "+"}{money(Math.abs(e.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* -------------------------------- LEDGER ------------------------------- */}
      {tab === "ledger" && (
        <Panel
          title="Ledger"
          actions={
            <button
              className={exportBtn}
              disabled={!entries || filteredEntries.length === 0}
              onClick={() =>
                exportSheet(`ledger-${storeName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`, "Ledger", ["Date", "Type", "Reference", "Details", "Sales", "Commission", "Discounts", "Amount", "Balance"], filteredEntries.map((e) => [day(e.at), KIND_LABEL[e.kind], e.ref, e.description, e.gross, e.commission, e.discount, e.amount, e.balance]))
              }
            >
              Download Excel
            </button>
          }
        >
          {!entries ? (
            <p className="p-5 text-sm text-neutral-500">The ledger needs the latest database update. Ask FasTrack to run it.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-neutral-100 p-4">
                <div className="flex flex-wrap gap-1.5">
                  {(["all", "sale", "refund", "payout"] as Kind[]).map((k) => (
                    <button key={k} onClick={() => setKind(k)} className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${kind === k ? "border-brand-600 bg-brand-50 text-brand-800" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"}`}>
                      {k === "all" ? "All" : KIND_LABEL[k] + "s"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <label className="flex flex-col gap-0.5 text-[11px] text-neutral-500 sm:flex-row sm:items-center sm:gap-2">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} /></label>
                  <label className="flex flex-col gap-0.5 text-[11px] text-neutral-500 sm:flex-row sm:items-center sm:gap-2">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} /></label>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order or reference" className={`${field} col-span-2 sm:w-56`} />
                  <button onClick={() => setNewestFirst((v) => !v)} className={`${exportBtn} col-span-2 sm:col-span-1`}>{newestFirst ? "Newest first ↓" : "Oldest first ↑"}</button>
                  {(from || to || q || kind !== "all") && (
                    <button onClick={() => { setFrom(""); setTo(""); setQ(""); setKind("all"); }} className="col-span-2 text-xs font-semibold text-brand-700 hover:underline sm:col-span-1">Clear filters</button>
                  )}
                </div>
              </div>
              {filteredEntries.length === 0 ? (
                <p className="p-6 text-center text-sm text-neutral-500">{entries.length === 0 ? "No activity yet." : "Nothing matches these filters."}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Type</th>
                        <th className="px-3 py-2.5">Reference</th>
                        <th className="px-3 py-2.5">Details</th>
                        <th className="px-3 py-2.5 text-right">Sales</th>
                        <th className="px-3 py-2.5 text-right">Commission</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                        <th className="px-4 py-2.5 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredEntries.map((e, i) => (
                        <tr key={i} className="hover:bg-neutral-50">
                          <td className="whitespace-nowrap px-4 py-2.5 text-neutral-500">{dateFmt(e.at)}</td>
                          <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${KIND_STYLE[e.kind]}`}>{KIND_LABEL[e.kind]}</span></td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-medium text-neutral-800">
                            {role === "admin" && e.orderId ? <Link href={`/admin/orders/${e.orderId}`} className="text-brand-700 hover:underline">{e.ref}</Link> : e.ref || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-neutral-500">{e.description}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right text-neutral-600">{e.kind === "payout" ? "—" : money(e.gross)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right text-neutral-500">{e.kind === "payout" || e.commission === 0 ? "—" : `${e.commission > 0 ? "−" : "+"}${money(Math.abs(e.commission))}`}</td>
                          <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold ${e.amount < 0 ? "text-neutral-700" : "text-emerald-700"}`}>{e.amount < 0 ? "−" : "+"}{money(Math.abs(e.amount))}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-neutral-900">{money(e.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50 px-4 py-3 text-sm">
                <span className="text-neutral-500">{filteredEntries.length} entr{filteredEntries.length === 1 ? "y" : "ies"} shown</span>
                <span className="font-semibold text-neutral-900">Net of shown entries: {filteredSum < 0 ? "−" : ""}{money(Math.abs(filteredSum))}</span>
              </div>
            </>
          )}
        </Panel>
      )}

      {/* -------------------------------- ORDERS ------------------------------- */}
      {tab === "orders" && (
        <Panel
          title={`Delivered orders (${filteredOrders.length}${filteredOrders.length !== orders.length ? ` of ${orders.length}` : ""})`}
          actions={
            <button
              className={exportBtn}
              disabled={filteredOrders.length === 0}
              onClick={() => exportSheet(`orders-${storeName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`, "Orders", ["Order", "Delivered", "Items", "Sales", "Refunded", "Commission", "Tax inside", "Net to supplier"], filteredOrders.map((o) => [o.orderNumber, day(o.deliveredAt), o.itemCount, o.lineTotal, o.refunded, o.commissionAmount, o.taxAmount, o.netAmount]))}
            >
              Download Excel
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-2 border-b border-neutral-100 p-4 sm:flex sm:flex-wrap sm:items-center">
            <input value={oq} onChange={(e) => setOq(e.target.value)} placeholder="Search order number" className={`${field} col-span-2 sm:w-56`} />
            <label className="flex flex-col gap-0.5 text-[11px] text-neutral-500 sm:flex-row sm:items-center sm:gap-2">From<input type="date" value={ofrom} onChange={(e) => setOfrom(e.target.value)} className={field} /></label>
            <label className="flex flex-col gap-0.5 text-[11px] text-neutral-500 sm:flex-row sm:items-center sm:gap-2">To<input type="date" value={oto} onChange={(e) => setOto(e.target.value)} className={field} /></label>
          </div>
          {filteredOrders.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-500">{orders.length === 0 ? "No delivered orders yet." : "Nothing matches these filters."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-2.5">Order</th>
                    <th className="px-3 py-2.5">Delivered</th>
                    <th className="px-3 py-2.5 text-right">Items</th>
                    <th className="px-3 py-2.5 text-right">Sales</th>
                    <th className="px-3 py-2.5 text-right">Refunded</th>
                    <th className="px-3 py-2.5 text-right">Commission</th>
                    <th className="px-4 py-2.5 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredOrders.map((o) => (
                    <tr key={o.orderId} className="hover:bg-neutral-50">
                      <td className="px-4 py-2.5 font-medium text-neutral-800">{role === "admin" ? <Link href={`/admin/orders/${o.orderId}`} className="text-brand-700 hover:underline">{o.orderNumber}</Link> : o.orderNumber}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-neutral-500">{dateFmt(o.deliveredAt)}</td>
                      <td className="px-3 py-2.5 text-right text-neutral-500">{o.itemCount}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-neutral-700">{money(o.lineTotal)}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right ${o.refunded > 0 ? "text-amber-700" : "text-neutral-300"}`}>{o.refunded > 0 ? `−${money(o.refunded)}` : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-neutral-500">{money(o.commissionAmount)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-neutral-900">{money(o.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-200 bg-neutral-50 text-sm font-semibold">
                    <td className="px-4 py-3" colSpan={3}>Total</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{money(oTotals.sales)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-amber-700">{oTotals.refunded > 0 ? `−${money(oTotals.refunded)}` : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{money(oTotals.commission)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{money(oTotals.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* -------------------------------- PAYOUTS ------------------------------ */}
      {tab === "payouts" && (
        <Panel
          title={`Payouts (${payouts.length})`}
          actions={
            <button className={exportBtn} disabled={payouts.length === 0} onClick={() => exportSheet(`payouts-${storeName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`, "Payouts", ["Date", "Amount", "Method", "Reference", "Note"], payouts.map((p) => [day(p.createdAt), p.amount, methodLabel(p.method), p.reference ?? "", p.note ?? ""]))}>
              Download Excel
            </button>
          }
        >
          {payouts.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-500">No payouts yet. {role === "admin" ? "Use Record payout above when you pay this supplier." : "When FasTrack pays you, it appears here."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Method</th>
                    <th className="px-3 py-2.5">Reference</th>
                    <th className="px-3 py-2.5">Note</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="whitespace-nowrap px-4 py-2.5 text-neutral-500">{dateFmt(p.createdAt)}</td>
                      <td className="px-3 py-2.5 text-neutral-700">{methodLabel(p.method)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-neutral-700">{p.reference || "—"}</td>
                      <td className="px-3 py-2.5 text-neutral-500">{p.note || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-emerald-700">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-200 bg-neutral-50 font-semibold">
                    <td className="px-4 py-3" colSpan={4}>Total paid out</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{money(payouts.reduce((s, p) => s + p.amount, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* ------------------------------- STATEMENTS ---------------------------- */}
      {tab === "statements" && (
        <div className="flex flex-col gap-5">
          <Panel title="Monthly statements">
            <ul className="divide-y divide-neutral-100">
              {months.map((m) => (
                <li key={m.from} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="font-medium text-neutral-800">{m.label}</span>
                  <span className="flex gap-2">
                    <a href={link(m.from, m.to, "pdf")} className={exportBtn + " inline-flex items-center"}>PDF</a>
                    <a href={link(m.from, m.to, "xlsx")} className={exportBtn + " inline-flex items-center"}>Excel</a>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Choose your own dates">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1 text-xs text-neutral-500">From<input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} className={field} /></label>
              <label className="flex flex-col gap-1 text-xs text-neutral-500">To<input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} className={field} /></label>
              <span className="flex gap-2">
                <a href={customOk ? link(cFrom, cTo, "pdf") : undefined} className={`${exportBtn} inline-flex h-10 items-center ${customOk ? "" : "pointer-events-none opacity-40"}`}>PDF</a>
                <a href={customOk ? link(cFrom, cTo, "xlsx") : undefined} className={`${exportBtn} inline-flex h-10 items-center ${customOk ? "" : "pointer-events-none opacity-40"}`}>Excel</a>
              </span>
            </div>
            <p className="px-4 pb-4 text-xs text-neutral-500">A statement shows the opening balance, sales, refunds, commission, payouts and the closing balance for the period.</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
