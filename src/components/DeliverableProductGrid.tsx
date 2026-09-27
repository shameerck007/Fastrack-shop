"use client";

import ProductCard from "@/components/ProductCard";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import type { ProductWithVariants } from "@/types/database";
import type { ProductRating } from "@/lib/reviews";

// Swiggy/Instamart-style: rather than showing an item and telling the
// shopper it can't be delivered, sellers who can't reach the shopper's
// chosen location are left out of browsing entirely. Nothing is filtered
// until a location is actually known (loading / not-yet-chosen), so
// first-time or anonymous visitors still see the full catalog.
export default function DeliverableProductGrid({
  products,
  ratings,
  stock,
  className = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
}: {
  products: ProductWithVariants[];
  ratings?: Map<string, ProductRating> | Record<string, ProductRating>;
  stock?: Map<string, number> | Record<string, number>;
  className?: string;
}) {
  const { statusForStore } = useDeliveryLocation();

  const getRating = (id: string) => (ratings instanceof Map ? ratings.get(id) : ratings?.[id]);
  const getStock = (id: string) => (stock instanceof Map ? stock.get(id) : stock?.[id]);

  const visible = products.filter((p) => statusForStore(p.store_id).state !== "outside");

  if (visible.length === 0) return null;

  return (
    <div className={className}>
      {visible.map((product) => (
        <ProductCard key={product.id} product={product} rating={getRating(product.id)} stock={getStock(product.id)} />
      ))}
    </div>
  );
}
