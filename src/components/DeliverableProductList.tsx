"use client";

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
    return <p className="text-sm text-neutral-500">{emptyMessage}</p>;
  }

  const anyVisible = products.some((p) => statusForStore(p.store_id).state !== "outside");
  if (!anyVisible) {
    return (
      <p className="text-sm text-neutral-500">
        Nothing here can be delivered to your current location yet.
      </p>
    );
  }

  return <DeliverableProductGrid products={products} ratings={ratings} stock={stock} />;
}
