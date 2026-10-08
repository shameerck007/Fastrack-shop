"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Select from "@/components/ui/Select";
import type { MasterProduct } from "@/lib/master-catalog";

export interface FilterCategory {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface CatalogListState {
  q: string;
  cat: string;
  page: number;
  tab: string;
}

/**
 * Keeps the catalog list in the browser and updates it in place as the user types or pages: one small request per change
 * (stale ones are cancelled), the previous results stay on screen while the next ones load, and repeat searches are instant.
 */
export function useCatalogList(opts: {
  initial: { items: MasterProduct[]; total: number } & CatalogListState;
  pageSize: number;
  /** Maps the tab to the catalog status to load. */
  statusFor?: (tab: string) => "approved" | "pending";
  withOffers?: boolean;
}) {
  const { initial, pageSize, statusFor = () => "approved", withOffers = false } = opts;
  const [state, setState] = useState<CatalogListState>({ q: initial.q, cat: initial.cat, page: initial.page, tab: initial.tab });
  const [data, setData] = useState<{ items: MasterProduct[]; total: number }>({ items: initial.items, total: initial.total });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const cache = useRef(new Map<string, { items: MasterProduct[]; total: number }>());
  const abort = useRef<AbortController | null>(null);
  const first = useRef(true);
  const lastQ = useRef(initial.q);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const key = JSON.stringify([state.q.trim().toLowerCase(), state.cat, state.page, state.tab]);
    if (first.current) {
      first.current = false;
      cache.current.set(key, { items: initial.items, total: initial.total });
      return;
    }
    // The address bar follows the search, so a refresh or a shared link shows the same list.
    try {
      const url = new URL(window.location.href);
      const set = (k: string, v: string) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
      set("q", state.q.trim());
      set("cat", state.cat === "all" ? "" : state.cat);
      set("page", state.page > 1 ? String(state.page) : "");
      set("tab", state.tab === "catalog" ? "" : state.tab);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* the address bar is a nicety only */
    }
    const hit = cache.current.get(key);
    if (hit) {
      abort.current?.abort();
      setData(hit);
      setFailed(false);
      setLoading(false);
      return;
    }
    // Typing waits a moment for the next key; paging, tabs and the category switch load straight away.
    const delay = state.q !== lastQ.current ? 140 : 0;
    lastQ.current = state.q;
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ status: statusFor(state.tab), page: String(state.page), size: String(pageSize) });
        if (state.q.trim()) qs.set("q", state.q.trim());
        if (state.cat !== "all") qs.set("cat", state.cat);
        if (withOffers) qs.set("offers", "1");
        const res = await fetch(`/api/catalog/search?${qs}`, { signal: ctl.signal, credentials: "same-origin" });
        if (!res.ok) throw new Error("search failed");
        const json = (await res.json()) as { items: MasterProduct[]; total: number };
        cache.current.set(key, json);
        setData(json);
        setFailed(false);
        setLoading(false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setFailed(true);
        setLoading(false);
      }
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.q, state.cat, state.page, state.tab, tick]);

  const update = useCallback((changes: Partial<CatalogListState>) => {
    setState((s) => ({ ...s, page: changes.page ?? 1, ...changes }));
  }, []);

  /** Loads the current list again (after approving, adding to a store, and so on). */
  const reload = useCallback(() => {
    cache.current.clear();
    setTick((t) => t + 1);
  }, []);

  return { state, update, reload, items: data.items, total: data.total, loading, failed, pageSize };
}

/** Search box and category picker. Controlled by useCatalogList. */
export function CatalogSearch({
  categories,
  q,
  cat,
  onChange,
  loading,
  placeholder = "Search name, brand or barcode…",
}: {
  categories: FilterCategory[];
  q: string;
  cat: string;
  onChange: (c: { q?: string; cat?: string }) => void;
  loading?: boolean;
  placeholder?: string;
}) {
  const parents = categories.filter((c) => !c.parent_id);
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">🔍</span>
        <input
          type="search"
          value={q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder={placeholder}
          className="h-10 w-full rounded-full border border-neutral-300 bg-white pe-4 ps-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <Select value={cat} onChange={(e) => onChange({ cat: e.target.value })} className="min-w-[12rem]">
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
      </Select>
      <span className={`h-2 w-2 rounded-full bg-blue-600 transition-opacity ${loading ? "animate-pulse opacity-100" : "opacity-0"}`} aria-hidden />
    </div>
  );
}

/** Previous / next page controls with the "1–40 of 5,045" summary. */
export function CatalogPager({ page, pageSize, total, onPage, busy }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; busy?: boolean }) {
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
        <button type="button" className={btn} disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>
          ← Previous
        </button>
        <span className="px-1 font-semibold text-neutral-800">
          Page {page} of {pages.toLocaleString()}
        </span>
        <button type="button" className={btn} disabled={page >= pages || busy} onClick={() => onPage(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}

/** The Catalog / Requests switch. */
export function CatalogTabs({ tab, tabs, onTab }: { tab: string; tabs: { key: string; label: string; dot?: boolean }[]; onTab: (key: string) => void }) {
  return (
    <div className="flex w-fit rounded-full bg-neutral-100 p-0.5 text-sm font-bold">
      {tabs.map((t) => (
        <button key={t.key} type="button" onClick={() => onTab(t.key)} className={`h-9 rounded-full px-4 ${tab === t.key ? "bg-blue-700 text-white shadow" : "text-neutral-500"}`}>
          {t.label}
          {t.dot && tab !== t.key && <span className="ms-1 inline-block h-2 w-2 rounded-full bg-blue-500" />}
        </button>
      ))}
    </div>
  );
}
