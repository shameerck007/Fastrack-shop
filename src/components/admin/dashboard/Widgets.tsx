import type { ReactNode } from "react";

/** A white card with a title row; the building block of the dashboard. */
export function Panel({ title, hint, action, children, className = "" }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** "▲ 12.4%" against the previous period. `goodWhenDown` for figures where lower is better (cancellations). */
export function Delta({ change, goodWhenDown = false }: { change: number | null; goodWhenDown?: boolean }) {
  if (change === null) return <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700">New</span>;
  if (change === 0) return <span className="text-[11px] font-semibold text-neutral-400">no change</span>;
  const up = change > 0;
  const good = goodWhenDown ? !up : up;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {up ? "▲" : "▼"} {Math.abs(change)}%
    </span>
  );
}

/** A small line of the last values, for a figure's shape over the period. */
export function Sparkline({ values, color = "#2563eb" }: { values: number[]; color?: string }) {
  if (values.length < 2 || values.every((v) => v === 0)) return <div className="h-8" aria-hidden />;
  const w = 100;
  const h = 32;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Kpi({ label, value, change, goodWhenDown, hint, spark, color }: { label: string; value: string; change?: number | null; goodWhenDown?: boolean; hint?: string; spark?: number[]; color?: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white px-4 pb-3 pt-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{label}</p>
        {change !== undefined && <Delta change={change} goodWhenDown={goodWhenDown} />}
      </div>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">{value}</p>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      {spark && (
        <div className="mt-2">
          <Sparkline values={spark} color={color} />
        </div>
      )}
    </div>
  );
}

/** One bar split into labelled shares, with a legend. */
export function SplitBar({ parts, format }: { parts: { label: string; value: number; color: string }[]; format?: (n: number) => string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (total === 0) return <p className="py-3 text-sm text-neutral-400">Nothing yet in this period.</p>;
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, backgroundColor: p.color }} title={`${p.label}: ${p.value}`} />
          ))}
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-neutral-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
              {p.label}
            </span>
            <span className="font-semibold text-neutral-900">
              {format ? format(p.value) : p.value} <span className="font-normal text-neutral-400">· {Math.round((p.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars (one hue; the number is always written next to the bar). */
export function RankBars({ items, format, empty = "No sales in this period yet." }: { items: { label: string; value: number; sub?: string }[]; format: (n: number) => string; empty?: string }) {
  if (items.length === 0) return <p className="py-4 text-sm text-neutral-400">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ol className="flex flex-col gap-3">
      {items.map((it, i) => (
        <li key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-neutral-700" title={it.label}>
              <span className="me-1.5 text-xs font-bold text-neutral-300">{i + 1}</span>
              {it.label}
            </span>
            <span className="shrink-0 font-bold text-neutral-900">{format(it.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(3, (it.value / max) * 100)}%` }} />
          </div>
          {it.sub && <p className="mt-0.5 text-[11px] text-neutral-400">{it.sub}</p>}
        </li>
      ))}
    </ol>
  );
}
