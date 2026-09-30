"use client";

import { useMemo, useState } from "react";
import AdminProductCard from "@/components/admin/AdminProductCard";
import { useLocale } from "@/components/LocaleProvider";
import type { AdminProduct } from "@/lib/admin-products";
import type { Category, Warehouse } from "@/types/database";

export default function AdminProductSearch({
  products,
  categories,
  warehouses,
}: {
  products: AdminProduct[];
  categories: Category[];
  warehouses: Warehouse[];
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
          placeholder={t("admin.search_products_placeholder")}
          className="w-full max-w-sm rounded-full border border-neutral-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("admin.no_products_match_search")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <AdminProductCard key={product.id} product={product} categories={categories} warehouses={warehouses} />
          ))}
        </div>
      )}
    </>
  );
}
