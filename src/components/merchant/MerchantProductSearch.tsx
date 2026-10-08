"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import MerchantProductCard from "@/components/merchant/MerchantProductCard";
import { CatalogPager } from "@/components/CatalogFilters";
import { useLocale } from "@/components/LocaleProvider";
import type { MerchantProduct } from "@/lib/merchant";
import type { Category } from "@/types/database";

/** The supplier's own products: search and paging are done on the server (24 per page), the address bar keeps the state. */
export default function MerchantProductSearch({
  products,
  categories,
  total,
  page,
  pageSize,
  q,
}: {
  products: MerchantProduct[];
  categories: Category[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
}) {
  const { t } = useLocale();
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
    const timer = setTimeout(() => go({ q: text.trim(), page: "" }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="relative w-full max-w-sm">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">🔍</span>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("merchant.search_products_placeholder")}
            className="h-10 w-full rounded-full border border-neutral-300 bg-white pe-4 ps-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className={`h-2 w-2 rounded-full bg-blue-600 transition-opacity ${pending ? "animate-pulse opacity-100" : "opacity-0"}`} aria-hidden />
      </div>

      {products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">{t("merchant.no_products_match_search")}</p>
      ) : (
        <div className={`grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
          {products.map((product) => (
            <MerchantProductCard key={product.id} product={product} categories={categories} />
          ))}
        </div>
      )}

      <CatalogPager page={page} pageSize={pageSize} total={total} busy={pending} onPage={(p) => go({ page: p > 1 ? String(p) : "" })} />
    </div>
  );
}
