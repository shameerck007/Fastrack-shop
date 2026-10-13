"use client";

import { useState } from "react";
import { useMoney } from "@/components/MoneyProvider";
import type { DayPoint } from "@/lib/merchant-dashboard";

const RANGES = [
  { n: 7, label: "7 days" },
  { n: 14, label: "14 days" },
  { n: 30, label: "30 days" },
] as const;

const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Daily sales as bars, with a 7 / 14 / 30 day switch and a tooltip on each day. */
export default function DashSalesChart({ days }: { days: DayPoint[] }) {
  const money = useMoney();
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [hover, setHover] = useState<number | null>(null);
  const data = days.slice(-range);
  const total = data.reduce((s, d) => s + d.sales, 0);
  const orders = data.reduce((s, d) => s + d.orders, 0);
  const max = Math.max(1, ...data.map((d) => d.sales));
  const W = 640;
  const H = 200;
  const padB = 24;
  const padT = 10;
  const slot = W / data.length;
  const bar = Math.max(4, Math.min(28, slot * 0.62));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const base = H - padB;
  const h = hover == null ? null : data[hover];
  const labelEvery = range === 7 ? 1 : range === 14 ? 2 : 5;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-extrabold leading-tight tracking-tight text-neutral-900">{money(total)}</p>
          <p className="text-xs text-neutral-500">
            {orders} order{orders === 1 ? "" : "s"} in the last {range} days
          </p>
        </div>
        <div role="tablist" className="flex rounded-full bg-neutral-100 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.n}
              role="tab"
              aria-selected={range === r.n}
              onClick={() => setRange(r.n)}
              className={`h-8 rounded-full px-3.5 text-xs font-semibold transition ${range === r.n ? "bg-white text-brand-800 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Daily sales">
          {[0.5, 1].map((f) => (
            <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" className="text-neutral-100" />
          ))}
          <line x1={0} x2={W} y1={base} y2={base} stroke="currentColor" className="text-neutral-200" />
          {data.map((d, i) => {
            const cx = slot * i + slot / 2;
            const top = d.sales > 0 ? y(d.sales) : base - 2;
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i === hover ? null : i)}>
                <rect x={cx - slot / 2} y={0} width={slot} height={H} fill="transparent" />
                {hover === i && <rect x={cx - slot / 2 + 1} y={padT} width={slot - 2} height={base - padT} rx="6" className="fill-brand-50" />}
                <rect x={cx - bar / 2} y={top} width={bar} height={Math.max(2, base - top)} rx="4" className={d.sales > 0 ? "fill-brand-600" : "fill-neutral-200"} />
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 7} textAnchor="middle" className="fill-neutral-500" fontSize="11">
                    {fmtDay(d.day)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {h && (
          <div className="pointer-events-none absolute right-1 top-0 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg">
            <p className="font-semibold text-neutral-900">{fmtDay(h.day)}</p>
            <p className="text-brand-700">{money(h.sales)}</p>
            <p className="text-neutral-500">
              {h.orders} order{h.orders === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
