import type { ReactNode } from "react";
import Glyph from "@/components/ui/Glyph";

/** The title block every admin page starts with: icon, title, one-line help and (right side) the page's main action. */
export function PageHeader({ icon, title, subtitle, actions }: { icon: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg text-white shadow-sm"><Glyph icon={icon} className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight text-neutral-900">{title}</h1>
          {subtitle && <p className="mt-0.5 line-clamp-2 max-w-3xl text-xs text-neutral-500 sm:text-[13px]">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A headline number tile. Pass a grid wrapper: `grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 lg:grid-cols-4`. */
export function StatTile({ icon, label, value, hint, accent = "#2563eb" }: { icon: string; label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3.5 py-3 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base" style={{ background: `${accent}1a`, color: accent }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p className="break-words text-lg font-bold leading-tight text-neutral-900 sm:text-xl">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>}
      </div>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 lg:grid-cols-4">{children}</div>;
}
