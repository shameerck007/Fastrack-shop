"use client";

import { useMemo, useState } from "react";
import MerchantProductCard from "@/components/merchant/MerchantProductCard";
import { useLocale } from "@/components/LocaleProvider";
import type { MerchantProduct } from "@/lib/merchant";
import type { Category } from "@/types/database";

export default function MerchantProductSearch({
  products,
  categories,
}: {
  products: MerchantProduct[];
  categories: Category[];
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.name_ar, p.brand, p.brand_ar, p.sku, p.category?.name]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [products, query]);

  return (
    <>
      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("merchant.search_products_placeholder")}
          className="w-full max-w-sm rounded-full border border-neutral-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("merchant.no_products_match_search")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <MerchantProductCard key={product.id} product={product} categories={categories} />
          ))}
        </div>
      )}
    </>
  );
}
