"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { Field, inputClass, primaryButton, secondaryButton } from "@/components/ui/Form";
import { useMoney } from "@/components/MoneyProvider";
import { getStatementPreview } from "@/lib/actions/settlements";
import { errorText, unwrapAction } from "@/lib/errors";
import type { Statement } from "@/lib/statement";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function presets() {
  const now = new Date();
  const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastPrev = new Date(now.getFullYear(), now.getMonth(), 0);
  const firstPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const first3 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return [
    { id: "this", label: "This month", from: iso(firstThis), to: iso(now) },
    { id: "last", label: "Last month", from: iso(firstPrev), to: iso(lastPrev) },
    { id: "three", label: "Last 3 months", from: iso(first3), to: iso(now) },
  ];
}

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 text-sm ${strong ? "font-extrabold" : ""}`}>
      <span className={strong ? "text-neutral-900" : "text-neutral-600"}>{label}</span>
      <span className={tone ?? "text-neutral-900"}>{value}</span>
    </div>
  );
}

/** A supplier's settlement statement: pick a period, see the numbers, download as PDF or a spreadsheet. */
export default function StatementDialog({ storeId, label = "Statement" }: { storeId: string; label?: string }) {
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function openIt() {
    const p = presets()[1];
    setOpen(true);
    load(p.from, p.to);
  }

  function load(nf: string, nt: string) {
    setFrom(nf);
    setTo(nt);
    if (!nf || !nt) return;
    setLoading(true);
    setError(null);
    unwrapAction(getStatementPreview)(storeId, nf, nt)
      .then((d) => setData(d))
      .catch((e) => {
        setError(errorText(e, "Could not load the statement."));
        setData(null);
      })
      .finally(() => setLoading(false));
  }

  const link = (format: "pdf" | "xlsx") => `/api/settlements/statement?store=${storeId}&from=${from}&to=${to}&format=${format}`;
  return (
    <>
      <button type="button" onClick={openIt} className={secondaryButton}>
        📄 {label}
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} size="md">
          <div className="-m-5 flex flex-col">
            <div className="flex items-center gap-3 border-b border-neutral-100 bg-gradient-to-r from-blue-50 via-white to-white px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg shadow-sm ring-1 ring-neutral-200">📄</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-extrabold tracking-tight text-neutral-900">Settlement statement</h2>
                <p className="truncate text-xs text-neutral-500">{data?.store.name ?? "Pick a period"}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100">
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-4 bg-neutral-50 p-4 sm:p-5">
              <div className="flex flex-wrap gap-1.5">
                {presets().map((p) => (
                  <button key={p.id} type="button" onClick={() => load(p.from, p.to)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${from === p.from && to === p.to ? "bg-blue-700 text-white" : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-100"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From">
                  <input type="date" value={from} onChange={(e) => load(e.target.value, to)} className={inputClass} />
                </Field>
                <Field label="To">
                  <input type="date" value={to} onChange={(e) => load(from, e.target.value)} className={inputClass} />
                </Field>
              </div>
              <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                {error ? (
                  <p className="text-sm font-medium text-rose-700">{error}</p>
                ) : loading || !data ? (
                  <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    <Line label="Opening balance" value={money(data.opening_balance)} />
                    <Line label={`Sales (${data.orders} order${data.orders === 1 ? "" : "s"})`} value={money(data.sales)} />
                    <Line label="Refunds" value={`-${money(data.refunds)}`} tone={data.refunds > 0 ? "text-amber-700" : undefined} />
                    <Line label="FasTrack commission" value={`-${money(data.commission)}`} />
                    {data.supplier_discounts > 0 && <Line label="Discounts you paid" value={`-${money(data.supplier_discounts)}`} />}
                    <Line label="Net for the period" value={money(data.net_for_period)} strong />
                    <Line label="Paid out" value={`-${money(data.paid_in_period)}`} />
                    <Line label="Closing balance" value={money(data.closing_balance)} strong tone="text-blue-700" />
                    <p className="pt-2 text-[11px] text-neutral-400">Sales include {money(data.tax_inside)} of tax (VAT / GST) that is part of the customer prices.</p>
                  </div>
                )}
              </section>
              <div className="flex flex-wrap justify-end gap-2">
                <a href={error || !data ? undefined : link("xlsx")} className={`${secondaryButton} ${error || !data ? "pointer-events-none opacity-50" : ""}`}>
                  ⬇ Excel
                </a>
                <a href={error || !data ? undefined : link("pdf")} className={`${primaryButton} ${error || !data ? "pointer-events-none opacity-50" : ""}`}>
                  ⬇ Download PDF
                </a>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
