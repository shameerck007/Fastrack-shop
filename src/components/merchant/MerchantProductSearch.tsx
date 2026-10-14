"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import MerchantProductCard from "@/components/merchant/MerchantProductCard";
import { CatalogPager } from "@/components/CatalogFilters";
import { useLocale } from "@/components/LocaleProvider";
import NavIcon from "@/components/ui/NavIcon";
import type { MerchantProduct, ProductSort, ProductView } from "@/lib/merchant";
import type { Category } from "@/types/database";

const VIEWS: { value: ProductView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Switched off" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
];

const SORTS: { value: ProductSort; label: string }[] = [
  { value: "new", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A to Z" },
];

const selectClass = "h-10 w-full min-w-0 rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

/**
 * The supplier's own products: search, a row of views (all, active, switched off, low stock, out of stock), a category and a sort order.
 * Everything is done on the server (24 per page) and the address bar keeps the state. On a phone the bar sticks under the top of the
 * screen, so the filters stay in reach while scrolling a long list.
 */
export default function MerchantProductSearch({
  products,
  categories,
  total,
  page,
  pageSize,
  q,
  view = "all",
  cat = "",
  sort = "new",
}: {
  products: MerchantProduct[];
  categories: Category[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  view?: ProductView;
  cat?: string;
  sort?: ProductSort;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [text, setText] = useState(q);
  const first = useRef(true);
  const parents = categories.filter((c) => !c.parent_id);

  function go(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    // Any change to what is shown starts again from the first page.
    if (!("page" in changes)) next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => go({ q: text.trim() }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const filtered = view !== "all" || !!cat || !!text.trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-14 z-20 -mx-4 flex flex-col gap-2.5 border-b border-neutral-200/80 bg-neutral-50/95 px-4 pb-3 pt-2 backdrop-blur md:static md:mx-0 md:rounded-2xl md:border md:border-neutral-200 md:bg-white md:p-3 md:shadow-sm">
        <div className="relative">
          <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
            <NavIcon name="search" className="h-4 w-4" />
          </span>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("merchant.search_products_placeholder")}
            aria-label="Search your products"
            className="h-11 w-full rounded-full border border-neutral-300 bg-white pe-10 ps-10 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <span className={`absolute end-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-brand-600 transition-opacity ${pending ? "animate-pulse opacity-100" : "opacity-0"}`} aria-hidden />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Show">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              role="tab"
              aria-selected={view === v.value}
              onClick={() => go({ view: v.value === "all" ? "" : v.value })}
              className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold transition ${view === v.value ? "bg-brand-700 text-white shadow-sm" : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-brand-50"}`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 md:max-w-xl">
          <select value={cat} onChange={(e) => go({ cat: e.target.value })} aria-label="Category" className={selectClass}>
            <option value="">All categories</option>
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
          <select value={sort} onChange={(e) => go({ sort: e.target.value === "new" ? "" : e.target.value })} aria-label="Sort by" className={selectClass}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="-mt-1 text-xs text-neutral-500" aria-live="polite">
        {total.toLocaleString()} product{total === 1 ? "" : "s"}
        {filtered && (
          <>
            {" · "}
            <button type="button" onClick={() => { setText(""); go({ q: "", view: "", cat: "", sort: "" }); }} className="font-semibold text-brand-700 hover:underline">
              Clear filters
            </button>
          </>
        )}
      </p>

      {products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">{t("merchant.no_products_match_search")}</p>
      ) : (
        <div className={`grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
          {products.map((product) => (
            <MerchantProductCard key={product.id} product={product} categories={categories} />
          ))}
        </div>
      )}

      <CatalogPager page={page} pageSize={pageSize} total={total} busy={pending} onPage={(p) => go({ page: p > 1 ? String(p) : "" })} />
    </div>
  );
}
