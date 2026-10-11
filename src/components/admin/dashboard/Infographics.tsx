"use client";

import { useEffect, useState } from "react";
import { useMoney } from "@/components/MoneyProvider";
import { PALETTE } from "./palette";

function useMounted(delay = 80) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return on;
}

const compact = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)));
const hourName = (h: number) => (h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ------------------------------------------------------------------ order clock */

const PARTS = [
  { key: "morning", name: "Morning", icon: "🌅", range: "6 AM – 12 PM", from: 6, to: 12, color: "#f59e0b" },
  { key: "afternoon", name: "Afternoon", icon: "☀️", range: "12 – 5 PM", from: 12, to: 17, color: "#f97316" },
  { key: "evening", name: "Evening", icon: "🌆", range: "5 – 10 PM", from: 17, to: 22, color: "#d946ef" },
  { key: "night", name: "Night", icon: "🌙", range: "10 PM – 6 AM", from: 22, to: 30, color: "#6366f1" },
];
const partOf = (h: number) => PARTS.find((p) => (h >= p.from && h < p.to) || (p.key === "night" && (h >= 22 || h < 6))) ?? PARTS[0];

/** When customers order, drawn as a 24-hour clock: every hour is a ray, longer = busier, coloured by part of the day. */
export function OrderClock({ cells }: { cells: [number, number, number][] }) {
  const on = useMounted();
  const [hot, setHot] = useState<number | null>(null);
  const byHour = Array.from({ length: 24 }, () => 0);
  const byDay = Array.from({ length: 7 }, () => 0);
  for (const [d, h, n] of cells) {
    byHour[h] += n;
    byDay[d - 1] += n;
  }
  const total = byHour.reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="py-12 text-center text-sm text-neutral-500">No orders in this period yet.</p>;
  const maxH = Math.max(...byHour, 1);
  const peakHour = byHour.indexOf(maxH);
  const maxD = Math.max(...byDay, 1);
  const peakDay = byDay.indexOf(maxD);
  const shown = hot ?? peakHour;
  const partTotals = PARTS.map((p) => ({ ...p, n: byHour.reduce((s, v, h) => (partOf(h).key === p.key ? s + v : s), 0) }));

  const C = 150;
  const R0 = 58;
  const RMAX = 118;
  const ray = (h: number, r: number) => {
    const a = ((h + 0.5) / 24) * Math.PI * 2 - Math.PI / 2;
    return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r };
  };

  return (
    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[24rem]">
        <svg viewBox="0 0 300 300" className="h-auto w-full" role="img" aria-label="Orders by hour of the day">
          {[R0, (R0 + RMAX) / 2, RMAX].map((r) => (
            <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeDasharray="2 4" />
          ))}
          {byHour.map((n, h) => {
            const a = ray(h, R0);
            const b = ray(h, R0 + 6 + (n / maxH) * (RMAX - R0 - 6));
            const c = partOf(h).color;
            return (
              <g key={h} onMouseEnter={() => setHot(h)} onMouseLeave={() => setHot(null)} style={{ cursor: "pointer" }}>
                <line x1={a.x} y1={a.y} x2={ray(h, RMAX + 4).x} y2={ray(h, RMAX + 4).y} stroke="transparent" strokeWidth="11" />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} pathLength={100} stroke={c} strokeWidth="9" strokeLinecap="round" opacity={hot === null || hot === h ? (n === 0 ? 0.18 : 1) : 0.3} strokeDasharray={`${on ? 100 : 0} 100`} style={{ transition: `stroke-dasharray .9s cubic-bezier(.2,.8,.2,1) ${h * 35}ms, opacity .2s`, filter: n / maxH > 0.7 ? `drop-shadow(0 0 4px ${c})` : "none" }} />
              </g>
            );
          })}
          {[
            { h: 0, t: "12a", i: "🌙" },
            { h: 6, t: "6a", i: "🌅" },
            { h: 12, t: "12p", i: "☀️" },
            { h: 18, t: "6p", i: "🌆" },
          ].map((m) => {
            const a = (m.h / 24) * Math.PI * 2 - Math.PI / 2;
            return (
              <text key={m.h} x={C + Math.cos(a) * (RMAX + 17)} y={C + Math.sin(a) * (RMAX + 17) + 4} textAnchor="middle" fontSize="17" fill="#64748b">
                {m.i}
              </text>
            );
          })}
          <circle cx={C} cy={C} r={R0 - 8} fill="rgba(255,255,255,0.7)" stroke="rgba(15,23,42,0.06)" />
          <text x={C} y={C - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">
            {hot === null ? "PEAK HOUR" : hourName(shown).toUpperCase()}
          </text>
          <text x={C} y={C + 14} textAnchor="middle" fontSize="22" fontWeight="800" fill="#0f172a" style={{ fontFamily: "ui-monospace, monospace" }}>
            {hot === null ? hourName(peakHour) : `${byHour[shown]}`}
          </text>
          <text x={C} y={C + 30} textAnchor="middle" fontSize="10" fill="#64748b">
            {hot === null ? `${byHour[peakHour]} orders` : byHour[shown] === 1 ? "order" : "orders"}
          </text>
        </svg>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {partTotals.map((p) => {
            const pct = Math.round((p.n / total) * 100);
            return (
              <div key={p.key} className="rounded-2xl border border-white/70 bg-white/55 p-3 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-bold text-neutral-800">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl text-base" style={{ background: `${p.color}22` }}>
                      {p.icon}
                    </span>
                    <span>
                      {p.name}
                      <span className="block text-[10px] font-medium text-neutral-500">{p.range}</span>
                    </span>
                  </span>
                  <span className="text-xl font-extrabold" style={{ color: p.color }}>
                    {pct}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-900/[0.07]">
                  <div className="h-full rounded-full" style={{ width: on ? `${Math.max(pct, p.n ? 4 : 0)}%` : "0%", background: `linear-gradient(90deg, ${p.color}aa, ${p.color})`, transition: "width 1.1s cubic-bezier(.2,.8,.2,1)" }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/55 p-3 backdrop-blur">
          <p className="mb-2 text-xs font-bold text-neutral-700">
            Busiest day: <span className="text-blue-700">{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][peakDay]}</span>
          </p>
          <div className="flex h-20 items-end gap-2">
            {byDay.map((n, i) => (
              <div key={DAYS[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${DAYS[i]}: ${n} orders`}>
                <div className="relative w-full flex-1">
                  <div className="absolute inset-x-0 bottom-0 rounded-t-lg" style={{ height: on ? `${Math.max(6, (n / maxD) * 100)}%` : "0%", background: i === peakDay ? "linear-gradient(to top, #2563eb, #7c3aed)" : "linear-gradient(to top, #93c5fd55, #93c5fd)", transition: `height 1s cubic-bezier(.2,.8,.2,1) ${i * 70}ms` }} />
                </div>
                <span className={`text-[10px] font-semibold ${i === peakDay ? "text-blue-700" : "text-neutral-500"}`}>{DAYS[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ supplier bubbles */

interface Bubble {
  label: string;
  total: number;
  part: number;
  orders: number;
}

/** Circle packing: biggest in the middle, each next one in the free spot closest to the centre. */
function pack(radii: number[]) {
  const pos: { x: number; y: number }[] = [];
  radii.forEach((r, i) => {
    if (i === 0) {
      pos.push({ x: 0, y: 0 });
      return;
    }
    let best: { x: number; y: number } | null = null;
    for (let d = 0; d < 500 && !best; d += 3) {
      for (let a = 0; a < 360; a += 8) {
        const x = Math.cos((a * Math.PI) / 180) * d * 1.25;
        const y = Math.sin((a * Math.PI) / 180) * d * 0.8;
        if (pos.every((p, j) => Math.hypot(p.x - x, p.y - y) >= radii[j] + r + 5)) {
          best = { x, y };
          break;
        }
      }
    }
    pos.push(best ?? { x: 0, y: 0 });
  });
  return pos;
}

/** Suppliers as floating bubbles: size is sales, the glowing ring on each is FasTrack's commission share. */
export function SupplierBubbles({ items }: { items: Bubble[] }) {
  const money = useMoney();
  const on = useMounted();
  const [hot, setHot] = useState(0);
  if (items.length === 0) return <p className="py-12 text-center text-sm text-neutral-500">No sales in this period yet.</p>;
  const sorted = [...items].sort((a, b) => b.total - a.total);
  const max = sorted[0].total || 1;
  const radii = sorted.map((s) => 34 + Math.sqrt(s.total / max) * 72);
  const pos = pack(radii);
  const minX = Math.min(...pos.map((p, i) => p.x - radii[i])) - 8;
  const maxX = Math.max(...pos.map((p, i) => p.x + radii[i])) + 8;
  const minY = Math.min(...pos.map((p, i) => p.y - radii[i])) - 8;
  const maxY = Math.max(...pos.map((p, i) => p.y + radii[i])) + 8;
  const totalSales = sorted.reduce((n, s) => n + s.total, 0);
  const cur = sorted[Math.min(hot, sorted.length - 1)];
  const share = totalSales ? Math.round((cur.total / totalSales) * 100) : 0;
  const rate = cur.total ? Math.round((cur.part / cur.total) * 1000) / 10 : 0;

  return (
    <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="h-auto max-h-[28rem] w-full" role="img" aria-label="Suppliers sized by sales">
        <defs>
          {sorted.map((_, i) => (
            <radialGradient key={i} id={`bub${i}`} cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor={PALETTE[(i * 3 + 1) % PALETTE.length]} stopOpacity="0.55" />
              <stop offset="100%" stopColor={PALETTE[(i * 3 + 1) % PALETTE.length]} stopOpacity="0.9" />
            </radialGradient>
          ))}
        </defs>
        {sorted.map((s, i) => {
          const c = PALETTE[(i * 3 + 1) % PALETTE.length];
          const r = radii[i];
          const cr = r - 4;
          const circ = 2 * Math.PI * cr;
          const frac = s.total ? s.part / s.total : 0;
          return (
            <g key={s.label} transform={`translate(${pos[i].x} ${pos[i].y})`} onMouseEnter={() => setHot(i)} style={{ cursor: "pointer" }}>
              <g style={{ transform: on ? "scale(1)" : "scale(0)", transition: `transform .8s cubic-bezier(.3,1.4,.4,1) ${i * 110}ms` }}>
                <circle r={r} fill={`url(#bub${i})`} stroke="rgba(255,255,255,0.85)" strokeWidth={hot === i ? 3 : 1.5} style={{ filter: `drop-shadow(0 6px 10px ${c}55)` }} />
                {frac > 0 && <circle r={cr} fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${Math.max(2, frac * 100)} 100`} transform="rotate(-90)" opacity="0.95" />}
                <text y={r > 40 ? -2 : 4} textAnchor="middle" fontSize={r > 40 ? 11 : 9} fontWeight="800" fill="#ffffff" style={{ paintOrder: "stroke", stroke: `${c}`, strokeWidth: 2.5, strokeLinejoin: "round" }}>
                  {s.label.length > (r > 40 ? 12 : 8) ? `${s.label.slice(0, r > 40 ? 11 : 7)}…` : s.label}
                </text>
                {r > 40 && (
                  <text y={13} textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff" style={{ paintOrder: "stroke", stroke: `${c}`, strokeWidth: 2.5, strokeLinejoin: "round" }}>
                    {compact(s.total)}
                  </text>
                )}
              </g>
            </g>
          );
        })}
      </svg>
      <div className="rounded-2xl border border-white/70 bg-white/55 p-4 backdrop-blur">
        <p className="truncate text-sm font-extrabold text-neutral-900">{cur.label}</p>
        <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-blue-700">{money(cur.total)}</p>
        <dl className="mt-3 grid gap-2 text-xs">
          <div className="flex justify-between">
            <dt className="text-neutral-500">Share of sales</dt>
            <dd className="font-bold text-neutral-800">{share}%</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Orders</dt>
            <dd className="font-bold text-neutral-800">{cur.orders}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">FasTrack commission</dt>
            <dd className="font-bold text-orange-600">{cur.part > 0 ? `${money(cur.part)} · ${rate}%` : "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-neutral-900/5 pt-2 text-[11px] text-neutral-500">Bubble size is sales. The white ring is the share FasTrack keeps. Hover a bubble.</p>
      </div>
    </div>
  );
}
