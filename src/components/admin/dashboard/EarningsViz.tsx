"use client";

import { useEffect, useId, useState } from "react";
import { useMoney } from "@/components/MoneyProvider";
import { BRAND, TEAL } from "./palette";
import { BRAND as BLUES } from "@/lib/brand";

const uid = (raw: string) => raw.replace(/[^a-zA-Z0-9]/g, "");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

function useMounted(delay = 80) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return on;
}

/* ------------------------------------------------------------------ money flow (sankey) */

export interface FlowInput {
  commission: number;
  deliveryFees: number;
  discounts: number;
  riderPay: number;
}

interface Node {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * Where FasTrack's money comes from and where it goes: the income streams flow into one pool, which then splits into
 * what is spent (rider pay, discounts) and what is kept. The width of each band is its amount.
 */
export function MoneyFlow({ commission, deliveryFees, discounts, riderPay }: FlowInput) {
  const money = useMoney();
  const id = uid(useId());
  const on = useMounted();
  const [hot, setHot] = useState<string | null>(null);

  const earned = Math.max(0, commission) + Math.max(0, deliveryFees);
  const spent = Math.max(0, discounts) + Math.max(0, riderPay);
  const kept = earned - spent;
  // When costs are higher than income the gap is a top-up from FasTrack's own pocket, drawn as a third source.
  const sources: Node[] = [
    { key: "commission", label: "Commission", value: Math.max(0, commission), color: BLUES[600] },
    { key: "delivery", label: "Delivery fees", value: Math.max(0, deliveryFees), color: "#0d9488" },
    ...(kept < 0 ? [{ key: "topup", label: "Paid from own pocket", value: -kept, color: "#94a3b8" }] : []),
  ].filter((n) => n.value > 0);
  const dests: Node[] = [
    { key: "rider", label: "Rider pay", value: Math.max(0, riderPay), color: "#e11d48" },
    { key: "discount", label: "FasTrack discounts", value: Math.max(0, discounts), color: "#f59e0b" },
    { key: "kept", label: "Kept as margin", value: Math.max(0, kept), color: "#059669" },
  ].filter((n) => n.value > 0);
  const pool = sources.reduce((n, s) => n + s.value, 0);

  if (pool <= 0) return <p className="py-12 text-center text-sm text-neutral-500">No money moved in this period yet.</p>;

  const W = 800;
  const H = 300;
  const top = 36;
  const avail = H - top - 14;
  const gap = 12;
  const scale = (avail - gap * Math.max(sources.length, dests.length, 1)) / pool;
  const colW = 16;
  const xL = 170;
  const xM = 392;
  const xR = 612;

  const layout = (nodes: Node[]) => {
    const total = nodes.reduce((n, s) => n + Math.max(3, s.value * scale), 0) + gap * (nodes.length - 1);
    let y = top + (avail - total) / 2;
    return nodes.map((n) => {
      const h = Math.max(3, n.value * scale);
      const out = { ...n, y, h };
      y += h + gap;
      return out;
    });
  };
  const L = layout(sources);
  const R = layout(dests);
  const midH = pool * scale;
  const midY = top + (avail - midH) / 2;

  const band = (x1: number, y1: number, x2: number, y2: number, h1: number, h2: number) => {
    const xm = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${xm} ${y1}, ${xm} ${y2}, ${x2} ${y2} L ${x2} ${y2 + h2} C ${xm} ${y2 + h2}, ${xm} ${y1 + h1}, ${x1} ${y1 + h1} Z`;
  };
  const bandsIn = L.reduce<{ n: (typeof L)[number]; path: string; at: number }[]>((acc, n) => {
    const at = acc.length ? acc[acc.length - 1].at + acc[acc.length - 1].n.value * scale : midY;
    acc.push({ n, path: band(xL + colW, n.y, xM, at, n.h, n.value * scale), at });
    return acc;
  }, []);
  const bandsOut = R.reduce<{ n: (typeof R)[number]; path: string; at: number }[]>((acc, n) => {
    const at = acc.length ? acc[acc.length - 1].at + acc[acc.length - 1].n.value * scale : midY;
    acc.push({ n, path: band(xM + colW, at, xR, n.y, n.value * scale, n.h), at });
    return acc;
  }, []);
  const dim = (k: string) => (hot === null || hot === k ? 1 : 0.35);
  const pct = (v: number, of: number) => (of > 0 ? `${Math.round((v / of) * 100)}%` : "");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="How commission and delivery fees flow into rider pay, discounts and margin" onMouseLeave={() => setHot(null)}>
      <defs>
        {bandsIn.map(({ n }) => (
          <linearGradient key={`i${n.key}`} id={`i${id}${n.key}`} x1="0" x2="1">
            <stop offset="0%" stopColor={n.color} stopOpacity="0.55" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.28" />
          </linearGradient>
        ))}
        {bandsOut.map(({ n }) => (
          <linearGradient key={`o${n.key}`} id={`o${id}${n.key}`} x1="0" x2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
            <stop offset="100%" stopColor={n.color} stopOpacity="0.6" />
          </linearGradient>
        ))}
        <clipPath id={`c${id}`}>
          <rect x="0" y="0" width={on ? W : 0} height={H} style={{ transition: "width 1.3s cubic-bezier(.2,.8,.2,1)" }} />
        </clipPath>
      </defs>

      <g clipPath={`url(#c${id})`}>
        {bandsIn.map(({ n, path }) => (
          <path key={n.key} d={path} fill={`url(#i${id}${n.key})`} opacity={dim(n.key)} style={{ transition: "opacity .2s" }} onMouseEnter={() => setHot(n.key)} />
        ))}
        {bandsOut.map(({ n, path }) => (
          <path key={n.key} d={path} fill={`url(#o${id}${n.key})`} opacity={dim(n.key)} style={{ transition: "opacity .2s" }} onMouseEnter={() => setHot(n.key)} />
        ))}
        {L.map((n) => (
          <rect key={n.key} x={xL} y={n.y} width={colW} height={n.h} rx="5" fill={n.color} onMouseEnter={() => setHot(n.key)} />
        ))}
        <rect x={xM} y={midY} width={colW} height={midH} rx="5" fill="#4338ca" />
        {R.map((n) => (
          <rect key={n.key} x={xR} y={n.y} width={colW} height={n.h} rx="5" fill={n.color} onMouseEnter={() => setHot(n.key)} />
        ))}
      </g>

      {L.map((n) => (
        <g key={`t${n.key}`} opacity={dim(n.key)} style={{ transition: "opacity .2s" }}>
          <text x={xL - 12} y={n.y + n.h / 2 - 3} textAnchor="end" fontSize="13" fontWeight="700" fill="#0f172a">
            {n.label}
          </text>
          <text x={xL - 12} y={n.y + n.h / 2 + 14} textAnchor="end" fontSize="13" fill="#475569">
            {money(n.value)}
          </text>
        </g>
      ))}
      <text x={xM + colW / 2} y={midY - 22} textAnchor="middle" fontSize="11" fontWeight="700" fill="#4338ca" letterSpacing="0.06em">
        MONEY EARNED
      </text>
      <text x={xM + colW / 2} y={midY - 6} textAnchor="middle" fontSize="14" fontWeight="800" fill="#0f172a">
        {money(earned)}
      </text>
      {R.map((n) => (
        <g key={`r${n.key}`} opacity={dim(n.key)} style={{ transition: "opacity .2s" }}>
          <text x={xR + colW + 12} y={n.y + n.h / 2 - 3} fontSize="13" fontWeight="700" fill="#0f172a">
            {n.label}
          </text>
          <text x={xR + colW + 12} y={n.y + n.h / 2 + 14} fontSize="13" fill="#475569">
            {money(n.value)} · {pct(n.value, pool)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ cumulative margin */

export interface DayPoint {
  date: string;
  margin: number;
}

/** Margin building up day by day (the line) with each day's margin underneath (bars). Move over it to read a day. */
export function CumulativeMargin({ days }: { days: DayPoint[] }) {
  const money = useMoney();
  const id = uid(useId());
  const on = useMounted();
  const [hot, setHot] = useState<number | null>(null);
  const W = 760;
  const H = 260;
  const pad = { l: 8, r: 8, t: 20, b: 26 };
  if (days.length === 0) return <p className="py-10 text-center text-sm text-neutral-500">No days in this period.</p>;
  const cum = days.reduce<number[]>((acc, d) => [...acc, (acc.length ? acc[acc.length - 1] : 0) + d.margin], []);
  const topC = Math.max(...cum, 1);
  const lowC = Math.min(...cum, 0);
  const x = (i: number) => pad.l + (days.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (days.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + ((topC - v) / (topC - lowC || 1)) * (H - pad.t - pad.b);
  const line = cum.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(days.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const maxDay = Math.max(...days.map((d) => Math.abs(d.margin)), 1);
  const barH = (v: number) => (Math.abs(v) / maxDay) * 52;
  const bw = Math.max(2, Math.min(18, ((W - pad.l - pad.r) / days.length) * 0.62));
  const hover = hot === null ? null : days[hot];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Margin building up over the period" onMouseLeave={() => setHot(null)}>
        <defs>
          <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity="0.38" />
            <stop offset="100%" stopColor={TEAL} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`l${id}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor={BRAND} />
          </linearGradient>
          <filter id={`g${id}`} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id={`c${id}`}>
            <rect x="0" y="0" width={on ? W : 0} height={H} style={{ transition: "width 1.4s cubic-bezier(.2,.8,.2,1)" }} />
          </clipPath>
        </defs>
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="rgba(15,23,42,0.15)" strokeDasharray="4 4" />
        {days.map((d, i) => (
          <rect key={d.date} x={x(i) - bw / 2} y={d.margin >= 0 ? H - pad.b - barH(d.margin) : H - pad.b} width={bw} height={Math.max(1.5, barH(d.margin))} rx="3" fill={d.margin >= 0 ? "rgba(0,112,208,0.28)" : "rgba(225,29,72,0.4)"} />
        ))}
        <g clipPath={`url(#c${id})`}>
          <path d={area} fill={`url(#a${id})`} />
          <path d={line} fill="none" stroke={`url(#l${id})`} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" filter={`url(#g${id})`} />
        </g>
        {hot !== null && (
          <g>
            <line x1={x(hot)} x2={x(hot)} y1={pad.t} y2={H - pad.b} stroke="rgba(15,23,42,0.25)" />
            <circle cx={x(hot)} cy={y(cum[hot])} r="5.5" fill="#fff" stroke={BRAND} strokeWidth="3" />
          </g>
        )}
        {days.map((d, i) => (
          <rect key={`h${d.date}`} x={x(i) - (W - pad.l - pad.r) / days.length / 2} y={0} width={(W - pad.l - pad.r) / days.length} height={H} fill="transparent" onMouseEnter={() => setHot(i)} onTouchStart={() => setHot(i)} />
        ))}
        <text x={pad.l} y={H - 6} fontSize="11" fill="#64748b">
          {shortDate(days[0].date)}
        </text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="11" fill="#64748b">
          {shortDate(days[days.length - 1].date)}
        </text>
      </svg>
      {hover && hot !== null && (
        <div className="pointer-events-none absolute left-2 top-0 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
          <p className="font-bold text-neutral-900">{shortDate(hover.date)}</p>
          <p className="text-neutral-600">
            That day <b className={hover.margin >= 0 ? "text-emerald-700" : "text-rose-700"}>{money(hover.margin)}</b>
          </p>
          <p className="text-neutral-600">
            Running total <b className="text-brand-800">{money(cum[hot])}</b>
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ per-order bullets */

export interface BulletRow {
  label: string;
  hint: string;
  /** What the average delivered order earns (positive) or costs (negative) in this period. */
  value: number;
  /** The same figure in the period before, shown as a marker. */
  prev?: number;
}

/**
 * The average delivered order, line by line. Each bar grows from the centre line: right for money earned, left for money spent.
 * The white marker is last period's figure, so you can see at a glance which way each line is moving.
 */
export function OrderBullets({ rows, result, resultPrev }: { rows: BulletRow[]; result: number; resultPrev?: number }) {
  const money = useMoney();
  const on = useMounted();
  const max = Math.max(...rows.flatMap((r) => [Math.abs(r.value), Math.abs(r.prev ?? 0)]), Math.abs(result), 0.01);
  const pos = (v: number) => `${50 + (v / max) * 48}%`;
  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => {
        const earn = r.value >= 0;
        const w = on ? (Math.abs(r.value) / max) * 48 : 0;
        return (
          <div key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="text-sm font-bold text-neutral-900">{r.label}</span>
                <span className="ml-2 text-[11px] text-neutral-500">{r.hint}</span>
              </span>
              <span className={`shrink-0 text-sm font-extrabold tabular-nums ${earn ? "text-brand-800" : "text-rose-700"}`}>{money(r.value)}</span>
            </div>
            <div className="relative h-3.5 rounded-full bg-white/60 ring-1 ring-white/80">
              <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-300" />
              <div
                className="absolute inset-y-0 rounded-full"
                style={{
                  [earn ? "left" : "right"]: "50%",
                  width: `${w}%`,
                  background: earn ? "linear-gradient(90deg,#2e92e8,#005fb0)" : "linear-gradient(270deg,#fda4af,#e11d48)",
                  transition: "width 1.1s cubic-bezier(.2,.8,.2,1)",
                }}
              />
              {r.prev !== undefined && r.prev !== 0 && (
                <div className="absolute -inset-y-0.5 w-1 rounded-full bg-white shadow ring-1 ring-neutral-400" style={{ left: pos(r.prev), transform: "translateX(-50%)" }} title={`Previous period: ${money(r.prev)}`} />
              )}
            </div>
          </div>
        );
      })}
      <div className="mt-1 rounded-2xl border border-neutral-200 border-s-4 border-s-brand-600 bg-white px-4 py-3 text-neutral-900 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-bold">What one order leaves</span>
          <span className="text-xl font-extrabold tabular-nums">{money(result)}</span>
        </div>
        {resultPrev !== undefined && <p className="mt-0.5 text-[11px] text-neutral-500">Previous period {money(resultPrev)}</p>}
      </div>
      <p className="-mt-2 text-[11px] text-neutral-500">The white marker is the previous period.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ supplier pareto */

export interface SupplierBar {
  label: string;
  sales: number;
  commission: number;
}

/**
 * Commission by supplier, biggest first, with the running share of the total as a line.
 * A line that climbs fast means a few suppliers carry the income; a slow climb means it is spread out.
 */
export function SupplierPareto({ items }: { items: SupplierBar[] }) {
  const money = useMoney();
  const id = uid(useId());
  const on = useMounted();
  const [hot, setHot] = useState<number | null>(null);
  const list = items.filter((s) => s.commission > 0).slice(0, 6);
  const total = items.reduce((n, s) => n + Math.max(0, s.commission), 0);
  if (list.length === 0 || total <= 0) return <p className="py-10 text-center text-sm text-neutral-500">No commission earned in this period.</p>;
  const W = 640;
  const H = 280;
  const pad = { l: 10, r: 10, t: 28, b: 62 };
  const max = Math.max(...list.map((s) => s.commission), 1);
  const slot = (W - pad.l - pad.r) / list.length;
  const bw = Math.min(64, slot * 0.58);
  const yBar = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const yPct = (p: number) => pad.t + (1 - p) * (H - pad.t - pad.b);
  const cx = (i: number) => pad.l + slot * i + slot / 2;
  const cum = list.reduce<number[]>((acc, s) => [...acc, (acc.length ? acc[acc.length - 1] : 0) + s.commission / total], []);
  const line = cum.map((p, i) => `${i === 0 ? "M" : "L"} ${cx(i)} ${yPct(p)}`).join(" ");
  const trunc = (s: string) => (s.length > 13 ? `${s.slice(0, 12)}…` : s);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Commission by supplier with running share" onMouseLeave={() => setHot(null)}>
        <defs>
          <linearGradient id={`b${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={BLUES[400]} />
            <stop offset="100%" stopColor={BLUES[700]} />
          </linearGradient>
        </defs>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="rgba(15,23,42,0.18)" />
        {list.map((s, i) => {
          const h = H - pad.b - yBar(s.commission);
          const grow = on ? 1 : 0;
          return (
            <g key={s.label} onMouseEnter={() => setHot(i)} opacity={hot === null || hot === i ? 1 : 0.5} style={{ transition: "opacity .2s" }}>
              <rect x={cx(i) - bw / 2} y={H - pad.b - h * grow} width={bw} height={h * grow} rx="10" fill={`url(#b${id})`} style={{ transition: `all 900ms cubic-bezier(.2,.8,.2,1) ${i * 80}ms` }} />
              <text x={cx(i)} y={yBar(s.commission) - 8} textAnchor="middle" fontSize="12" fontWeight="800" fill="#0f172a" style={{ opacity: on ? 1 : 0, transition: `opacity 500ms ${500 + i * 80}ms` }}>
                {money(s.commission)}
              </text>
              <text x={cx(i)} y={H - pad.b + 18} textAnchor="middle" fontSize="12" fontWeight="700" fill="#334155">
                {trunc(s.label)}
              </text>
              <text x={cx(i)} y={H - pad.b + 34} textAnchor="middle" fontSize="11" fill="#64748b">
                {s.sales > 0 ? `${((s.commission / s.sales) * 100).toFixed(1)}% rate` : ""}
              </text>
              <text x={cx(i)} y={H - pad.b + 49} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {Math.round((s.commission / total) * 100)}% of total
              </text>
              <title>{`${s.label}: ${money(s.commission)} commission on ${money(s.sales)} sold`}</title>
            </g>
          );
        })}
        <path d={line} fill="none" stroke="#f59e0b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="600" strokeDashoffset={on ? 0 : 600} style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1) .3s" }} />
        {cum.map((p, i) => (
          <g key={`p${i}`}>
            <circle cx={cx(i)} cy={yPct(p)} r="4.5" fill="#fff" stroke="#f59e0b" strokeWidth="2.5" />
            {(i === cum.length - 1 || i === 0) && (
              <text x={cx(i) + (i === 0 ? 10 : -10)} y={yPct(p) - 9} textAnchor={i === 0 ? "start" : "end"} fontSize="11" fontWeight="700" fill="#b45309">
                {Math.round(p * 100)}% so far
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BLUES[700] }} /> Commission earned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: "#f59e0b" }} /> Share of all commission, adding up from the left
        </span>
      </p>
    </div>
  );
}
