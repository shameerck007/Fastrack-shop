"use client";

import EmptyState from "@/components/EmptyState";
import DeliverableProductGrid from "@/components/DeliverableProductGrid";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import type { ProductWithVariants } from "@/types/database";
import type { ProductRating } from "@/lib/reviews";

// For a page whose whole purpose is a product list (category, search,
// store), an empty result gets an explanatory message either way — unlike
// a home-page feed section, a blank page here would be confusing.
export default function DeliverableProductList({
  products,
  ratings,
  stock,
  emptyMessage,
}: {
  products: ProductWithVariants[];
  ratings: Record<string, ProductRating>;
  stock: Record<string, number>;
  emptyMessage: string;
}) {
  const { statusForStore } = useDeliveryLocation();

  if (products.length === 0) {
    return <EmptyState icon="📦" title={emptyMessage} />;
  }

  const anyVisible = products.some((p) => statusForStore(p.store_id).state !== "outside");
  if (!anyVisible) {
    return (
      <EmptyState icon="📍" title="Nothing to deliver to you yet" hint="These items can't be delivered to your current location. Try changing your delivery address." />
    );
  }

  return <DeliverableProductGrid products={products} ratings={ratings} stock={stock} />;
}
