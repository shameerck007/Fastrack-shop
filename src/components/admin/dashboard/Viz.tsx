"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMoney } from "@/components/MoneyProvider";

import { PALETTE } from "./palette";
import { BRAND } from "@/lib/brand";

const uid = (raw: string) => raw.replace(/[^a-zA-Z0-9]/g, "");

/** True once the component is on screen, so CSS transitions play from their empty state. */
function useMounted(delay = 60) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return on;
}

/* ------------------------------------------------------------------ count-up number */

export type NumKind = "money" | "int" | "pct";

export function CountUp({ value, kind = "int", decimals = 0, className = "", style }: { value: number; kind?: NumKind; decimals?: number; className?: string; style?: React.CSSProperties }) {
  const money = useMoney();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const a = from.current;
    const dur = reduce ? 1 : 1300;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const text = kind === "money" ? money(Math.round(shown * 100) / 100) : kind === "pct" ? `${shown.toFixed(decimals)}%` : shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span className={className} style={style}>
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ speedometer gauge */

export function Gauge({ value, label, caption, colors = ["#f43f5e", "#f59e0b", "#10b981"] }: { value: number; label: string; caption?: string; colors?: [string, string, string] }) {
  const id = uid(useId());
  const on = useMounted();
  const pct = Math.max(0, Math.min(100, value));
  const angle = -90 + (on ? pct : 0) * 1.8;
  const ticks = Array.from({ length: 11 }, (_, i) => i);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 124" className="w-full max-w-[15rem]" role="img" aria-label={`${label}: ${Math.round(pct)}%`}>
        <defs>
          <linearGradient id={`g${id}`} x1="20" x2="180" y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="50%" stopColor={colors[1]} />
            <stop offset="100%" stopColor={colors[2]} />
          </linearGradient>
          <filter id={`f${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="14" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" pathLength={100} fill="none" stroke={`url(#g${id})`} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${on ? pct : 0} 100`} filter={`url(#f${id})`} style={{ transition: "stroke-dasharray 1.4s cubic-bezier(.2,.8,.2,1)" }} />
        {ticks.map((i) => {
          const a = Math.PI - (i / 10) * Math.PI;
          const x1 = 100 + Math.cos(a) * 62;
          const y1 = 100 - Math.sin(a) * 62;
          const x2 = 100 + Math.cos(a) * (i % 5 === 0 ? 54 : 58);
          const y2 = 100 - Math.sin(a) * (i % 5 === 0 ? 54 : 58);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(15,23,42,0.35)" strokeWidth={i % 5 === 0 ? 1.6 : 1} />;
        })}
        <g style={{ transformOrigin: "100px 100px", transform: `rotate(${angle}deg)`, transition: "transform 1.4s cubic-bezier(.2,.8,.2,1)" }}>
          <polygon points="97,100 100,34 103,100" fill="#0f172a" />
        </g>
        <circle cx="100" cy="100" r="7" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
        <text x="22" y="118" fontSize="9" fill="rgba(15,23,42,0.4)" textAnchor="middle">0</text>
        <text x="178" y="118" fontSize="9" fill="rgba(15,23,42,0.4)" textAnchor="middle">100</text>
      </svg>
      <p className="-mt-1 font-mono text-3xl font-extrabold tabular-nums text-neutral-900">
        <CountUp value={pct} kind="pct" decimals={1} />
      </p>
      <p className="text-sm font-bold text-neutral-800">{label}</p>
      {caption && <p className="text-xs text-neutral-500">{caption}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ ring stat */

export function Ring({ pct, color, children }: { pct: number; color: string; children?: React.ReactNode }) {
  const id = uid(useId());
  const on = useMounted();
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
        <defs>
          <filter id={`r${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="4.5" />
        <circle cx="22" cy="22" r="18" pathLength={100} fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeDasharray={`${on ? p : 0} 100`} filter={`url(#r${id})`} style={{ transition: "stroke-dasharray 1.3s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ donut */

export interface Slice {
  label: string;
  value: number;
  color: string;
}

export function Donut({ slices, centerLabel, format = "int" }: { slices: Slice[]; centerLabel: string; format?: NumKind }) {
  const money = useMoney();
  const on = useMounted();
  const [hot, setHot] = useState<number | null>(null);
  const total = slices.reduce((n, s) => n + s.value, 0);
  const fmt = (v: number) => (format === "money" ? money(v) : v.toLocaleString("en-US"));
  const centerFmt = (v: number) => (format === "money" ? compact(v) : fmt(v));
  if (total === 0) return <p className="py-10 text-center text-sm text-neutral-500">Nothing to show for this period yet.</p>;
  const arcs = slices.map((s, i) => ({ ...s, i, len: (s.value / total) * 100, offset: slices.slice(0, i).reduce((n, x) => n + (x.value / total) * 100, 0) }));
  const active = hot !== null ? slices[hot] : null;
  return (
    <div className="flex min-w-0 flex-col items-center gap-4">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth="5" />
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx="21"
              cy="21"
              r="15.9"
              pathLength={100}
              fill="none"
              stroke={a.color}
              strokeWidth={hot === a.i ? 6.6 : 5}
              strokeDasharray={`${on ? Math.max(0, a.len - 0.9) : 0} 100`}
              strokeDashoffset={-a.offset}
              opacity={hot === null || hot === a.i ? 1 : 0.35}
              onMouseEnter={() => setHot(a.i)}
              onMouseLeave={() => setHot(null)}
              style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.2,.8,.2,1), stroke-width .2s, opacity .2s", cursor: "pointer" }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-mono text-2xl font-extrabold tabular-nums text-neutral-900">
            {centerFmt(active ? active.value : total)}
          </p>
          <p className="max-w-[6.5rem] truncate text-[11px] font-semibold text-neutral-500">{active ? `${active.label} · ${Math.round((active.value / total) * 100)}%` : centerLabel}</p>
        </div>
      </div>
      <ul className="grid w-full min-w-0 gap-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 transition hover:bg-neutral-100" onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
            <span className="flex min-w-0 items-center gap-2 text-neutral-700">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}` }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 font-bold text-neutral-900">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ radial bars */

export function RadialBars({ items, format }: { items: { label: string; value: number }[]; format: "money" | "int" }) {
  const money = useMoney();
  const on = useMounted();
  if (items.length === 0) return <p className="py-10 text-center text-sm text-neutral-500">No sales in this period yet.</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const fmt = (v: number) => (format === "money" ? money(v) : String(v));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 42 42" className="h-44 w-44 shrink-0 -rotate-[225deg]" role="img" aria-label="Sales by category">
        {items.map((it, i) => {
          const radius = 19.5 - i * 3.3;
          const pct = (it.value / max) * 75;
          return (
            <g key={it.label}>
              <circle cx="21" cy="21" r={radius} pathLength={100} fill="none" stroke="rgba(15,23,42,0.07)" strokeWidth="2.4" strokeDasharray="75 100" strokeLinecap="round" />
              <circle cx="21" cy="21" r={radius} pathLength={100} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="2.4" strokeLinecap="round" strokeDasharray={`${on ? pct : 0} 100`} style={{ transition: `stroke-dasharray 1.2s cubic-bezier(.2,.8,.2,1) ${i * 120}ms`, filter: `drop-shadow(0 0 1.2px ${PALETTE[i % PALETTE.length]})` }} />
            </g>
          );
        })}
      </svg>
      <ul className="grid w-full gap-1.5 text-sm">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-neutral-700">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length], boxShadow: `0 0 8px ${PALETTE[i % PALETTE.length]}` }} />
              <span className="truncate">{it.label}</span>
            </span>
            <span className="shrink-0 font-bold text-neutral-900">{fmt(it.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ gradient columns */

export function Columns({ items, format }: { items: { label: string; value: number }[]; format: "money" | "int" }) {
  const money = useMoney();
  const on = useMounted();
  if (items.length === 0) return <p className="py-10 text-center text-sm text-neutral-500">No sales in this period yet.</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const fmt = (v: number) => (format === "money" ? money(v) : String(v));
  return (
    <div className="flex h-52 items-end gap-2.5 sm:gap-3">
      {items.map((it, i) => {
        const c = PALETTE[i % PALETTE.length];
        return (
          <div key={it.label} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${it.label}: ${fmt(it.value)}`}>
            <span className="mb-1 truncate text-[11px] font-bold text-neutral-900 opacity-80 transition group-hover:opacity-100">{fmt(it.value)}</span>
            <div className="relative w-full flex-1">
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-xl"
                style={{
                  height: on ? `${Math.max(6, (it.value / max) * 100)}%` : "0%",
                  background: `linear-gradient(to top, ${c}55, ${c})`,
                  boxShadow: `0 6px 16px ${c}30`,
                  transition: `height 1.1s cubic-bezier(.2,.8,.2,1) ${i * 90}ms`,
                }}
              />
            </div>
            <span className="mt-2 line-clamp-2 h-8 w-full text-center text-[10px] font-medium leading-tight text-neutral-500">{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ stacked horizontal bars */

export function StackedBars({ items }: { items: { label: string; total: number; part: number; note: string }[] }) {
  const money = useMoney();
  const on = useMounted();
  if (items.length === 0) return <p className="py-10 text-center text-sm text-neutral-500">No sales in this period yet.</p>;
  const max = Math.max(...items.map((i) => i.total), 1);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-[11px] font-semibold text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "linear-gradient(90deg,#60a5fa,#1d4ed8)" }} /> Paid to the supplier
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} /> FasTrack commission
        </span>
      </div>
      <ul className="flex flex-col gap-3.5">
        {items.map((it, i) => {
          const w = (it.total / max) * 100;
          const cw = it.total > 0 ? (it.part / it.total) * 100 : 0;
          return (
            <li key={it.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-bold text-neutral-900">{it.label}</span>
                <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-neutral-900">
                  {money(it.total)} <span className="font-sans font-normal text-neutral-500">· {it.note}</span>
                </span>
              </div>
              <div className="h-3.5 w-full overflow-hidden rounded-full bg-neutral-200/70">
                <div className="flex h-full overflow-hidden rounded-full" style={{ width: on ? `${Math.max(3, w)}%` : "0%", transition: `width 1.2s cubic-bezier(.2,.8,.2,1) ${i * 100}ms`, boxShadow: "0 4px 12px rgba(29,78,216,.22)" }}>
                  <span style={{ width: `${100 - cw}%`, background: "linear-gradient(90deg,#60a5fa,#1d4ed8)" }} />
                  <span style={{ width: `${cw}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ performance chart */

const W = 880;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (iso: string, withYear = false) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
};
const compact = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)));
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

export interface Point {
  date: string;
  revenue: number;
  orders: number;
}

/** Sales as a glowing area, orders as columns underneath on the same days (two charts, never two axes in one). */
export function PerformanceChart({ series, previous }: { series: Point[]; previous: Point[] }) {
  const money = useMoney();
  const id = uid(useId());
  const on = useMounted(120);
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const n = series.length;
  const padL = 46;
  const padR = 10;
  const H1 = 210;
  const H2 = 64;
  const padT = 10;
  const pw = W - padL - padR;
  const maxRev = niceMax(Math.max(...series.map((d) => d.revenue), ...previous.map((d) => d.revenue), 0));
  const maxOrd = Math.max(...series.map((d) => d.orders), 1);
  const x = (i: number) => padL + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw);
  const y1 = (v: number) => padT + (H1 - padT - 18) - (v / maxRev) * (H1 - padT - 18);
  const line = series.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y1(d.revenue).toFixed(1)}`).join(" ");
  const prevLine = previous.slice(0, n).map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y1(d.revenue).toFixed(1)}`).join(" ");
  const area = n ? `${line} L${x(n - 1).toFixed(1)},${y1(0)} L${x(0).toFixed(1)},${y1(0)} Z` : "";
  const barW = Math.max(3, Math.min(22, (pw / Math.max(n, 1)) * 0.62));
  const every = Math.max(1, Math.ceil(n / 9));

  function move(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !n) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - padL) / pw) * (n - 1)))));
  }
  const h = hover !== null ? series[hover] : null;

  return (
    <div ref={ref} className="relative" onMouseMove={move} onMouseLeave={() => setHover(null)}>
      <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-semibold text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full bg-brand-700" /> Sales
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 border-t-2 border-dashed border-slate-500" /> Previous period
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "linear-gradient(#2dd4bf,#0d9488)" }} /> Orders
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H1 + H2 + 8}`} className="h-auto w-full" role="img" aria-label="Sales and orders per day with the previous period for comparison">
        <defs>
          <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={BRAND[600]} stopOpacity="0.28" />
            <stop offset="100%" stopColor={BRAND[600]} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`l${id}`} x1={padL} x2={W - padR} y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor={BRAND[700]} />
          </linearGradient>
          <linearGradient id={`b${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          <filter id={`s${id}`} x="-5%" y="-30%" width="110%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id={`c${id}`}>
            <rect x={padL} y="0" width={on ? pw + padR : 0} height={H1 + H2 + 8} style={{ transition: "width 1.4s cubic-bezier(.2,.8,.2,1)" }} />
          </clipPath>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={y1(f * maxRev)} y2={y1(f * maxRev)} stroke="rgba(15,23,42,0.07)" />
            <text x={padL - 8} y={y1(f * maxRev) + 4} textAnchor="end" fontSize="11" fill="#64748b">
              {compact(f * maxRev)}
            </text>
          </g>
        ))}
        <g clipPath={`url(#c${id})`}>
          {area && <path d={area} fill={`url(#a${id})`} />}
          {prevLine && <path d={prevLine} fill="none" stroke="#64748b" strokeWidth="1.6" strokeDasharray="5 4" />}
          {line && <path d={line} fill="none" stroke={`url(#l${id})`} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" filter={`url(#s${id})`} />}
        </g>
        {series.map((d, i) => {
          const bh = (d.orders / maxOrd) * (H2 - 6);
          return (
            <rect key={d.date} x={x(i) - barW / 2} y={H1 + 8 + (H2 - bh)} width={barW} height={on ? bh : 0} rx={3} fill={`url(#b${id})`} opacity={hover === null || hover === i ? 1 : 0.4} style={{ transition: `height .9s cubic-bezier(.2,.8,.2,1) ${i * 18}ms` }} />
          );
        })}
        {series.map((d, i) =>
          i % every === 0 || i === n - 1 ? (
            <text key={d.date} x={x(i)} y={H1 - 2} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="11" fill="#64748b">
              {dayLabel(d.date)}
            </text>
          ) : null
        )}
        {hover !== null && h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H1 + H2 + 8} stroke="rgba(15,23,42,0.25)" />
            <circle cx={x(hover)} cy={y1(h.revenue)} r="6" fill="#ffffff" stroke={BRAND[700]} strokeWidth="3" />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div className="pointer-events-none absolute top-8 z-10 w-48 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white/95 p-3 text-xs shadow-2xl backdrop-blur" style={{ left: `${Math.min(84, Math.max(16, (x(hover) / W) * 100))}%` }}>
          <p className="font-bold text-neutral-900">{dayLabel(h.date, true)}</p>
          <p className="mt-1.5 flex justify-between gap-2">
            <span className="text-neutral-500">Sales</span>
            <b className="text-brand-700">{money(h.revenue)}</b>
          </p>
          <p className="flex justify-between gap-2">
            <span className="text-neutral-500">Before</span>
            <b className="text-neutral-700">{money(previous[hover]?.revenue ?? 0)}</b>
          </p>
          <p className="flex justify-between gap-2">
            <span className="text-neutral-500">Orders</span>
            <b className="text-teal-700">{h.orders}</b>
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ sales trend (the sales card) */

/** The period's sales as a calm blue area, with the previous period as a dashed line. */
export function SalesTrend({ series, previous }: { series: Point[]; previous: Point[] }) {
  const on = useMounted(150);
  const id = uid(useId());
  const n = series.length;
  const W = 400;
  const H = 100;
  const pad = 4;
  const max = Math.max(...series.map((d) => d.revenue), ...previous.map((d) => d.revenue), 1);
  const x = (i: number) => (n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2));
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = series.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.revenue).toFixed(1)}`).join(" ");
  const prevLine = previous.slice(0, n).map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.revenue).toFixed(1)}`).join(" ");
  const area = n ? `${line} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z` : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label="Sales per day compared with the previous period">
      <defs>
        <linearGradient id={`st${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={BRAND[600]} stopOpacity="0.30" />
          <stop offset="100%" stopColor={BRAND[600]} stopOpacity="0" />
        </linearGradient>
        <clipPath id={`sc${id}`}>
          <rect x="0" y="0" width={on ? W : 0} height={H} style={{ transition: "width 1.3s cubic-bezier(.2,.8,.2,1)" }} />
        </clipPath>
      </defs>
      <g clipPath={`url(#sc${id})`}>
        {area && <path d={area} fill={`url(#st${id})`} />}
        {prevLine && <path d={prevLine} fill="none" stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        {line && <path d={line} fill="none" stroke={BRAND[700]} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      </g>
    </svg>
  );
}
