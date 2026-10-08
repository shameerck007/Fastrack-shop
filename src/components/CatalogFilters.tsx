"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface FilterCategory {
  id: string;
  name: string;
  parent_id: string | null;
}

/** Updates one or more URL params (the server re-renders the list), always going back to page 1 unless `page` is set. */
function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  function set(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    if (!("page" in changes)) next.delete("page");
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  return { params, set, pending };
}

/** Search box and category picker for a server-paged catalog list. */
export function CatalogSearch({ categories, placeholder = "Search name, brand or barcode…" }: { categories: FilterCategory[]; placeholder?: string }) {
  const { params, set, pending } = useUrlParams();
  const [text, setText] = useState(params.get("q") ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => set({ q: text.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const parents = categories.filter((c) => !c.parent_id);
  const cat = params.get("cat") ?? "all";

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">🔍</span>
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-full border border-neutral-300 bg-white pe-4 ps-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <select value={cat} onChange={(e) => set({ cat: e.target.value })} className="h-10 min-w-[10rem] rounded-full border border-neutral-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none">
        <option value="all">All categories</option>
        {parents.map((p) => {
          const kids = categories.filter((c) => c.parent_id === p.id);
          return kids.length === 0 ? (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ) : (
            <optgroup key={p.id} label={p.name}>
              <option value={p.id}>All {p.name}</option>
              {kids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      {pending && <span className="text-xs font-medium text-blue-700">Loading…</span>}
    </div>
  );
}

/** Previous / next page controls with the "1–48 of 5,045" summary. */
export function CatalogPager({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const { set, pending } = useUrlParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "h-9 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-white";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
      <span>
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={page <= 1 || pending} onClick={() => set({ page: String(page - 1) })}>
          ← Previous
        </button>
        <span className="px-1 font-semibold text-neutral-800">
          Page {page} of {pages.toLocaleString()}
        </span>
        <button type="button" className={btn} disabled={page >= pages || pending} onClick={() => set({ page: String(page + 1) })}>
          Next →
        </button>
      </div>
    </div>
  );
}

/** The Catalog / Requests switch, kept in the URL. */
export function CatalogTabs({ tab, tabs }: { tab: string; tabs: { key: string; label: string; dot?: boolean }[] }) {
  const { set } = useUrlParams();
  return (
    <div className="flex w-fit rounded-full bg-neutral-100 p-0.5 text-sm font-bold">
      {tabs.map((t) => (
        <button key={t.key} type="button" onClick={() => set({ tab: t.key === tabs[0].key ? null : t.key })} className={`h-9 rounded-full px-4 ${tab === t.key ? "bg-blue-700 text-white shadow" : "text-neutral-500"}`}>
          {t.label}
          {t.dot && tab !== t.key && <span className="ms-1 inline-block h-2 w-2 rounded-full bg-blue-500" />}
        </button>
      ))}
    </div>
  );
}
