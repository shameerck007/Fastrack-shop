"use client";

import { useEffect, useState } from "react";
import DeliverableProductGrid from "@/components/DeliverableProductGrid";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import { createClient } from "@/lib/supabase/client";
import type { ProductWithVariants } from "@/types/database";
import type { ProductRating } from "@/lib/reviews";
import { useLocale } from "@/components/LocaleProvider";

export default function BuyAgainSection() {
  const { t } = useLocale();
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

  const { statusForStore } = useDeliveryLocation();
  if (!products || products.length === 0) return null;
  if (!products.some((p) => statusForStore(p.store_id).state !== "outside")) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{t("home.buy_again")}</h2>
      <DeliverableProductGrid products={products} ratings={ratings} stock={stock} />
    </section>
  );
}
