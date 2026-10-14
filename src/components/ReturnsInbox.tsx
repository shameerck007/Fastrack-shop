"use client";

import { useState } from "react";
import ReceiveReturnDialog from "@/components/ReceiveReturnDialog";
import { RETURN_STATUS, STOCK_STATUS, reasonLabel, type ReturnRow } from "@/lib/returns";

export interface InboxReturn extends ReturnRow {
  product_name: string;
  order_number: string;
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The returns coming back to a supplier or a warehouse: what is on its way, and the ones to check in. */
export default function ReturnsInbox({ rows, empty }: { rows: InboxReturn[]; empty: string }) {
  const [receiving, setReceiving] = useState<InboxReturn | null>(null);
  const visible = rows.filter((r) => r.status !== "cancelled" && r.status !== "rejected");
  const waiting = visible.filter((r) => r.stock_status === "awaiting_dropoff");
  const rest = visible.filter((r) => r.stock_status !== "awaiting_dropoff");

  const card = (r: InboxReturn) => {
    const s = RETURN_STATUS[r.status];
    const st = r.stock_status ? STOCK_STATUS[r.stock_status] : null;
    return (
      <li key={r.id} className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-neutral-900">
              {r.product_name} × {r.quantity}
            </p>
            <p className="text-xs text-neutral-500">
              {r.return_number} · order #{r.order_number} · {when(r.created_at)}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${st ? st.tone : s.tone}`}>{st ? st.label : s.label}</span>
        </div>
        <p className="mt-2 text-sm text-neutral-700">
          <span className="font-semibold">{reasonLabel(r.reason)}</span>
          {r.details ? `: ${r.details}` : ""}
        </p>
        {r.photos.length > 0 && (
          <div className="mt-2 flex gap-2">
            {r.photos.map((p) => (
              <a key={p} href={p} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="Return photo" className="h-16 w-16 rounded-xl border border-neutral-200 object-cover" />
              </a>
            ))}
          </div>
        )}
        {r.resolution === "keep" && <p className="mt-2 text-xs text-neutral-500">The customer keeps this item. Nothing comes back.</p>}
        {r.received_note && <p className="mt-2 text-xs text-neutral-500">Note: {r.received_note}</p>}
        {r.stock_status === "awaiting_dropoff" && (
          <button type="button" onClick={() => setReceiving(r)} className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-700 px-5 text-base font-extrabold text-white hover:bg-brand-800 sm:h-10 sm:w-auto sm:text-sm">
            📥 Mark received
          </button>
        )}
      </li>
    );
  };

  if (visible.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center">
        <p className="text-3xl">↩️</p>
        <p className="mt-2 text-sm text-neutral-500">{empty}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {waiting.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-neutral-900">Coming back to you ({waiting.length})</h2>
          <ul className="grid gap-3 lg:grid-cols-2">{waiting.map(card)}</ul>
        </section>
      )}
      {rest.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-neutral-900">Other returns</h2>
          <ul className="grid gap-3 lg:grid-cols-2">{rest.map(card)}</ul>
        </section>
      )}
      {receiving && <ReceiveReturnDialog returnId={receiving.id} label={`${receiving.product_name} × ${receiving.quantity} · ${receiving.return_number}`} onClose={() => setReceiving(null)} />}
    </div>
  );
}
