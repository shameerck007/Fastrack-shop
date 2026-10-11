"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Select from "@/components/ui/Select";
import { CatalogPager } from "@/components/CatalogFilters";
import { CUSTOMER_FILTERS } from "@/lib/admin-customers";

/** Search box and filter for the customers list, plus paging. The address bar keeps the state; the page is rendered on the server. */
export default function CustomersToolbar({ q, filter, page, pageSize, total }: { q: string; filter: string; page: number; pageSize: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [text, setText] = useState(q);
  const first = useRef(true);

  function go(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => go({ q: text.trim(), page: "" }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">🔍</span>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search name, phone, email or order number…"
            className="h-10 w-full rounded-full border border-neutral-300 bg-white pe-4 ps-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <Select value={filter} onChange={(e) => go({ filter: e.target.value === "all" ? "" : e.target.value, page: "" })} className="w-56">
          {CUSTOMER_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <span className={`h-2 w-2 rounded-full bg-blue-600 transition-opacity ${pending ? "animate-pulse opacity-100" : "opacity-0"}`} aria-hidden />
      </div>
      <CatalogPager page={page} pageSize={pageSize} total={total} busy={pending} onPage={(p) => go({ page: p > 1 ? String(p) : "" })} />
    </div>
  );
}
