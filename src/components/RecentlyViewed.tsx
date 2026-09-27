"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DeliverableProductGrid from "@/components/DeliverableProductGrid";
import { useDeliveryLocation } from "@/components/delivery-location-context";
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

  const { statusForStore } = useDeliveryLocation();
  if (!products || products.length === 0) return null;
  if (!products.some((p) => statusForStore(p.store_id).state !== "outside")) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">🕘 Recently Viewed</h2>
      <DeliverableProductGrid products={products} />
    </section>
  );
}
