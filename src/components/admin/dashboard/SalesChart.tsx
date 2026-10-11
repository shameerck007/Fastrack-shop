"use client";

import { useMemo, useRef, useState } from "react";
import { useMoney } from "@/components/MoneyProvider";
import type { DayPoint } from "@/lib/admin-dashboard";

const W = 860;
const H = 280;
const PAD = { l: 52, r: 12, t: 14, b: 28 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Date text is built from the yyyy-mm-dd string, never from the viewer's clock, so the server and the browser always agree.
function dayLabel(iso: string, withYear = false) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}
const compact = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)));

/** The next "round" number above the max, so the grid lines land on tidy values. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

type Metric = "revenue" | "orders";

/** Sales over the chosen period with the previous period dashed behind it. One measure at a time, one axis. */
export default function SalesChart({ series, previous }: { series: DayPoint[]; previous: DayPoint[] }) {
  const money = useMoney();
  const [metric, setMetric] = useState<Metric>("revenue");
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  const n = series.length;
  const cur = series.map((d) => d[metric]);
  const prev = previous.map((d) => d[metric]);
  const max = niceMax(Math.max(...cur, ...prev, 0));
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw);
  const y = (v: number) => PAD.t + ph - (v / max) * ph;
  const fmt = (v: number) => (metric === "revenue" ? money(v) : `${v} order${v === 1 ? "" : "s"}`);

  const path = useMemo(() => cur.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" "), [cur, n, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevPath = useMemo(() => prev.slice(0, n).map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" "), [prev, n, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const area = n > 0 ? `${path} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z` : "";
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(n / 8));
  const total = cur.reduce((a, b) => a + b, 0);
  const prevTotal = prev.reduce((a, b) => a + b, 0);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const r = ref.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / pw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const h = hover !== null ? series[hover] : null;
  const hp = hover !== null ? previous[hover] : null;
  const leftPct = hover !== null ? (x(hover) / W) * 100 : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold tracking-tight text-neutral-900">{metric === "revenue" ? "Sales" : "Orders"} over time</p>
          <p className="text-xs text-neutral-500">
            <span className="mr-3 inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-blue-600" /> This period {metric === "revenue" ? money(total) : `${total} orders`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0 w-4 border-t-2 border-dashed border-neutral-400" /> Previous period {metric === "revenue" ? money(prevTotal) : `${prevTotal} orders`}
            </span>
          </p>
        </div>
        <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-0.5" role="tablist">
          {(["revenue", "orders"] as Metric[]).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={metric === m} onClick={() => setMetric(m)} className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${metric === m ? "bg-white text-blue-700 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}>
              {m === "revenue" ? "Sales" : "Orders"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${metric === "revenue" ? "Sales" : "Orders"} per day, with the previous period for comparison`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#eef0f3" strokeWidth={1} />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
                {compact(t)}
              </text>
            </g>
          ))}
          {series.map((d, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={d.date} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="11" fill="#9ca3af">
                {dayLabel(d.date)}
              </text>
            ) : null
          )}
          {area && <path d={area} fill="url(#salesArea)" />}
          {prevPath && <path d={prevPath} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="5 4" strokeLinejoin="round" />}
          {path && <path d={path} fill="none" stroke="#2563eb" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(cur[hover])} r={5} fill="#2563eb" stroke="#fff" strokeWidth={2} />
            </g>
          )}
        </svg>
        {h && hp && hover !== null && (
          <div className="pointer-events-none absolute top-2 z-10 w-44 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white p-2.5 text-xs shadow-lg" style={{ left: `${Math.min(86, Math.max(14, leftPct))}%` }}>
            <p className="font-bold text-neutral-900">{dayLabel(h.date, true)}</p>
            <p className="mt-1 flex justify-between gap-2">
              <span className="text-neutral-500">This period</span>
              <b className="text-blue-700">{fmt(cur[hover])}</b>
            </p>
            <p className="flex justify-between gap-2">
              <span className="text-neutral-500">Previous</span>
              <b className="text-neutral-700">{fmt(prev[hover] ?? 0)}</b>
            </p>
            <p className="mt-1 border-t border-neutral-100 pt-1 text-neutral-500">
              {metric === "revenue" ? `${h.orders} order${h.orders === 1 ? "" : "s"}` : money(h.revenue)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
