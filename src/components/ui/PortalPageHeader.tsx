import type { ReactNode } from "react";
import Glyph from "@/components/ui/Glyph";

/**
 * The title block at the top of every supplier page: a small neutral icon, the title, one line of help, optional chips, and the page's
 * main actions on the right. Plain on purpose (no coloured card), so the content below is what stands out.
 */
export default function PortalPageHeader({ icon, title, subtitle, meta, actions }: { icon: string; title: string; subtitle?: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-neutral-200 pb-4">
      <div className="flex min-w-0 flex-1 items-start gap-3 basis-72">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-xl shadow-sm" aria-hidden>
          <Glyph icon={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-neutral-900">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm leading-snug text-neutral-500">{subtitle}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A small neutral chip for the header's meta line. */
export function MetaChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const cls = tone === "good" ? "bg-emerald-50 text-emerald-700" : tone === "warn" ? "bg-amber-50 text-amber-800" : "bg-neutral-100 text-neutral-600";
  return <span className={`rounded-full px-2.5 py-1 font-medium ${cls}`}>{children}</span>;
}
