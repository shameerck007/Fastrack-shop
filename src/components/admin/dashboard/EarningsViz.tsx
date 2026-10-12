"use client";

import { useEffect, useId, useState } from "react";
import { useMoney } from "@/components/MoneyProvider";
import { BRAND, ROSE, TEAL } from "./palette";

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

export interface Step {
  label: string;
  value: number;
  kind: "plus" | "minus" | "total";
}

/** From the two income streams to the margin: each bar starts where the one before it ended. Bars rise into place. */
export function MarginWaterfall({ steps }: { steps: Step[] }) {
  const money = useMoney();
  const id = uid(useId());
  const on = useMounted();
  const [hot, setHot] = useState<number | null>(null);
  const W = 760;
  const H = 280;
  const padT = 34;
  const padB = 46;
  const bars = steps.reduce<(Step & { lo: number; hi: number; end: number })[]>((acc, s) => {
    const run = acc.length ? acc[acc.length - 1].end : 0;
    const start = s.kind === "total" ? 0 : run;
    const end = s.kind === "total" ? s.value : s.kind === "plus" ? run + s.value : run - s.value;
    acc.push({ ...s, lo: Math.min(start, end), hi: Math.max(start, end), end });
    return acc;
  }, []);
  const top = Math.max(...bars.map((b) => b.hi), 1);
  const bottom = Math.min(...bars.map((b) => b.lo), 0);
  const y = (v: number) => padT + ((top - v) / (top - bottom || 1)) * (H - padT - padB);
  const bw = W / bars.length;
  const paint = (b: (typeof bars)[number]): [string, string] => (b.kind === "total" ? (b.value >= 0 ? ["#34d399", "#059669"] : ["#fb7185", "#e11d48"]) : b.kind === "plus" ? (b.label === "Commission" ? ["#60a5fa", "#1d4ed8"] : ["#5eead4", "#0d9488"]) : b.label === "Rider pay" ? ["#fda4af", "#e11d48"] : ["#fcd34d", "#d97706"]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="From commission and delivery fees to the marketplace margin">
      <defs>
        {bars.map((b, i) => {
          const [a, c] = paint(b);
          return (
            <linearGradient key={i} id={`w${id}${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={a} />
              <stop offset="100%" stopColor={c} />
            </linearGradient>
          );
        })}
        <filter id={`s${id}`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#1e3a8a" floodOpacity="0.18" />
        </filter>
      </defs>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgba(15,23,42,0.18)" strokeDasharray="4 4" />
      {bars.map((b, i) => {
        const x = i * bw + bw * 0.2;
        const w = bw * 0.6;
        const h = Math.max(3, y(b.lo) - y(b.hi));
        const grow = on ? 1 : 0;
        return (
          <g key={b.label} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} style={{ cursor: "default" }} opacity={hot === null || hot === i ? 1 : 0.55}>
            <rect
              x={x}
              y={y(b.lo) - h * grow}
              width={w}
              height={h * grow}
              rx="12"
              fill={`url(#w${id}${i})`}
              filter={`url(#s${id})`}
              style={{ transition: `all 900ms cubic-bezier(.2,.8,.2,1) ${i * 90}ms` }}
            />
            {i < bars.length - 1 && <line x1={x + w} x2={x + bw * 0.4 + w} y1={y(b.end)} y2={y(b.end)} stroke="rgba(15,23,42,0.3)" strokeDasharray="3 3" />}
            <text x={x + w / 2} y={y(b.hi) - 10} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a" style={{ opacity: on ? 1 : 0, transition: `opacity 600ms ${400 + i * 90}ms` }}>
              {b.kind === "minus" ? "−" : b.kind === "plus" ? "+" : ""}
              {money(Math.abs(b.value))}
            </text>
            <text x={x + w / 2} y={H - 20} textAnchor="middle" fontSize="12" fontWeight="700" fill="#475569">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

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
          <rect key={d.date} x={x(i) - bw / 2} y={d.margin >= 0 ? H - pad.b - barH(d.margin) : H - pad.b} width={bw} height={Math.max(1.5, barH(d.margin))} rx="3" fill={d.margin >= 0 ? "rgba(37,99,235,0.28)" : "rgba(225,29,72,0.4)"} />
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
            Running total <b className="text-blue-800">{money(cum[hot])}</b>
          </p>
        </div>
      )}
    </div>
  );
}

/** A thin two-colour bar showing where one amount goes (for example how much of the delivery fee the rider takes). */
export function SplitBar({ left, right, leftLabel, rightLabel, leftColor = BRAND, rightColor = ROSE }: { left: number; right: number; leftLabel: string; rightLabel: string; leftColor?: string; rightColor?: string }) {
  const on = useMounted();
  const total = left + right;
  const lp = total > 0 ? (left / total) * 100 : 0;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-neutral-200/70">
        <div className="h-full" style={{ width: on ? `${lp}%` : "0%", background: leftColor, transition: "width 1.2s cubic-bezier(.2,.8,.2,1)" }} />
        <div className="h-full" style={{ width: on ? `${100 - lp}%` : "0%", background: rightColor, transition: "width 1.2s cubic-bezier(.2,.8,.2,1)" }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold">
        <span style={{ color: leftColor }}>{leftLabel}</span>
        <span style={{ color: rightColor }}>{rightLabel}</span>
      </div>
    </div>
  );
}

