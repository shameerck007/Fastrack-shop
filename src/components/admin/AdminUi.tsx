import type { ReactNode } from "react";

/** The title block every admin page starts with: icon, title, one-line help and (right side) the page's main action. */
export function PageHeader({ icon, title, subtitle, actions }: { icon: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">{icon}</span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
          {subtitle && <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A headline number tile. Pass a grid wrapper: `grid grid-cols-2 gap-3 lg:grid-cols-4`. */
export function StatTile({ icon, label, value, hint, accent = "#2563eb" }: { icon: string; label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: `${accent}1a`, color: accent }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p className="truncate text-2xl font-semibold leading-tight text-neutral-900">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>}
      </div>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}
