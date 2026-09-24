"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import type { ProductWithVariants } from "@/types/database";

const STORAGE_KEY = "ft_recently_viewed";

export default function RecentlyViewed({ excludeProductId }: { excludeProductId?: string }) {
  const [products, setProducts] = useState<ProductWithVariants[] | null>(null);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      let ids: string[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        ids = raw ? JSON.parse(raw) : [];
      } catch {
        ids = [];
      }
      ids = ids.filter((id) => id !== excludeProductId);
      if (ids.length === 0) {
        setProducts([]);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("*, category:categories(*), product_variants(*)")
        .in("id", ids)
        .eq("is_active", true);

      const byId = new Map((data ?? []).map((p) => [p.id, p as ProductWithVariants]));
      setProducts(ids.map((id) => byId.get(id)).filter((p): p is ProductWithVariants => !!p));
    }, 0);

    return () => clearTimeout(timeout);
  }, [excludeProductId]);

  if (!products || products.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">🕘 Recently Viewed</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
