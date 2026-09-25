"use client";

import { useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { createClient } from "@/lib/supabase/client";
import type { ProductWithVariants } from "@/types/database";
import type { ProductRating } from "@/lib/reviews";

export default function BuyAgainSection() {
  const [products, setProducts] = useState<ProductWithVariants[] | null>(null);
  const [ratings, setRatings] = useState<Record<string, ProductRating>>({});
  const [stock, setStock] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled || !user) return;
      const res = await fetch("/api/buy-again");
      if (cancelled || !res.ok) return;
      const data = await res.json();
      setProducts(data.products);
      setRatings(data.ratings);
      setStock(data.stock);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!products || products.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">🔄 Buy Again</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            rating={ratings[product.id]}
            stock={stock[product.id]}
          />
        ))}
      </div>
    </section>
  );
}
