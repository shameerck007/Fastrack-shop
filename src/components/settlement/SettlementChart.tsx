"use client";

import { useState } from "react";
import type { MonthlyPoint } from "@/lib/settlements";
import { useMoney } from "@/components/MoneyProvider";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Net earned and paid out by month: two bars per month, the money still owed shown as the gap between them over time. */
export default function SettlementChart({ points, title = "Earned and paid out by month" }: { points: MonthlyPoint[]; title?: string }) {
  const money = useMoney();
  const [hover, setHover] = useState<number | null>(null);
  const data = points.slice(-12);
  if (data.length === 0) return <p className="py-8 text-center text-sm text-neutral-500">Nothing to chart yet.</p>;

  const W = 640;
  const H = 220;
  const padL = 8;
  const padB = 26;
  const padT = 14;
  const max = Math.max(1, ...data.flatMap((d) => [d.net, d.paidOut]));
  const slot = (W - padL) / data.length;
  const bar = Math.min(26, slot * 0.34);
  const y = (v: number) => padT + (H - padT - padB) * (1 - Math.max(0, v) / max);
  const base = H - padB;
  const h = hover == null ? null : data[hover];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Net earned</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Paid out</span>
        </div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={padL} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" className="text-neutral-100" strokeWidth="1" />
          ))}
          <line x1={padL} x2={W} y1={base} y2={base} stroke="currentColor" className="text-neutral-200" />
          {data.map((d, i) => {
            const cx = padL + slot * i + slot / 2;
            const d0 = new Date(`${d.month}T00:00:00`);
            return (
              <g key={d.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i === hover ? null : i)}>
                <rect x={cx - slot / 2} y={0} width={slot} height={H} fill="transparent" />
                {hover === i && <rect x={cx - slot / 2 + 2} y={padT} width={slot - 4} height={base - padT} rx="6" className="fill-brand-50" />}
                <rect x={cx - bar - 1} y={y(d.net)} width={bar} height={Math.max(0, base - y(d.net))} rx="4" className="fill-brand-600" />
                <rect x={cx + 1} y={y(d.paidOut)} width={bar} height={Math.max(0, base - y(d.paidOut))} rx="4" className="fill-emerald-500" />
                <text x={cx} y={H - 8} textAnchor="middle" className="fill-neutral-500" fontSize="11">
                  {MONTHS[d0.getMonth()]}
                  {d0.getMonth() === 0 || i === 0 ? ` ${String(d0.getFullYear()).slice(2)}` : ""}
                </text>
              </g>
            );
          })}
        </svg>
        {h && (
          <div className="pointer-events-none absolute right-2 top-0 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg">
            <p className="font-semibold text-neutral-900">
              {MONTHS[new Date(`${h.month}T00:00:00`).getMonth()]} {new Date(`${h.month}T00:00:00`).getFullYear()}
            </p>
            <p className="text-neutral-600">Sales {money(h.gross)}</p>
            <p className="text-neutral-600">Commission −{money(h.commission)}</p>
            {h.refunds > 0 && <p className="text-amber-700">Refunds −{money(h.refunds)}</p>}
            <p className="text-brand-700">Net earned {money(h.net)}</p>
            <p className="text-emerald-700">Paid out {money(h.paidOut)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
