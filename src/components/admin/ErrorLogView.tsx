"use client";

import { useMemo, useState } from "react";

export interface ErrorRow {
  id: string;
  ref: string | null;
  area: string | null;
  path: string | null;
  message: string;
  detail: string | null;
  created_at: string;
  user_id: string | null;
}

const AREA_STYLE: Record<string, string> = {
  admin: "bg-violet-50 text-violet-700",
  merchant: "bg-emerald-50 text-emerald-700",
  rider: "bg-amber-50 text-amber-700",
  warehouse: "bg-sky-50 text-sky-700",
  shop: "bg-brand-50 text-brand-700",
  toast: "bg-neutral-100 text-neutral-600",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function ErrorLogView({ rows, last24h }: { rows: ErrorRow[]; last24h: number }) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const areas = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => r.area ?? "other")))], [rows]);
  const needle = q.trim().toLowerCase();
  const list = rows.filter((r) => (area === "all" || (r.area ?? "other") === area) && (!needle || `${r.ref ?? ""} ${r.message} ${r.path ?? ""} ${r.detail ?? ""}`.toLowerCase().includes(needle)));

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3 sm:p-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by reference code, message or page…" className="h-10 min-w-[12rem] flex-1 rounded-xl border border-neutral-300 px-3.5 text-sm placeholder:text-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
        <div className="flex flex-wrap gap-1.5">
          {areas.map((a) => (
            <button key={a} type="button" onClick={() => setArea(a)} className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${area === a ? "bg-brand-700 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
              {a}
            </button>
          ))}
        </div>
        <span className="text-xs text-neutral-500">
          {rows.length} logged · {last24h} in the last 24 hours
        </span>
      </div>
      {list.length === 0 ? (
        <p className="p-10 text-center text-sm text-neutral-500">{rows.length === 0 ? "No errors logged. Good news." : "Nothing matches your search."}</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {list.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="grid w-full grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 px-4 py-3 text-start transition hover:bg-neutral-50 sm:grid-cols-[7rem_5rem_minmax(0,1fr)_auto]">
                <span className="text-xs text-neutral-500">{when(r.created_at)}</span>
                <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${AREA_STYLE[r.area ?? ""] ?? "bg-neutral-100 text-neutral-600"}`}>{r.area ?? "other"}</span>
                <span className="col-span-2 min-w-0 sm:col-span-1">
                  <span className="block truncate text-sm font-semibold text-neutral-900">{r.message}</span>
                  <span className="block truncate text-xs text-neutral-500">{r.path ?? "—"}</span>
                </span>
                <span className="font-mono text-xs font-bold tracking-wider text-neutral-700">{r.ref ?? ""}</span>
              </button>
              {open === r.id && (
                <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
                  <p>
                    <b className="text-neutral-800">Message:</b> {r.message}
                  </p>
                  {r.detail && (
                    <p className="mt-1 break-words font-mono text-[11px] leading-relaxed">
                      <b className="font-sans text-neutral-800">Technical details:</b> {r.detail}
                    </p>
                  )}
                  <p className="mt-1">
                    <b className="text-neutral-800">Page:</b> {r.path ?? "—"} · <b className="text-neutral-800">User:</b> {r.user_id ?? "not signed in"}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
