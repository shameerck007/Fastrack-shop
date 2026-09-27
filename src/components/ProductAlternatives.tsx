"use client";

import DeliverableProductGrid from "@/components/DeliverableProductGrid";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import type { ProductWithVariants } from "@/types/database";
import type { ProductRating } from "@/lib/reviews";

export default function ProductAlternatives({
  storeId,
  products,
  ratings,
  stock,
}: {
  storeId: string | null;
  products: ProductWithVariants[];
  ratings: Record<string, ProductRating>;
  stock: Record<string, number>;
}) {
  const { statusForStore } = useDeliveryLocation();
  if (statusForStore(storeId).state !== "outside") return null;
  if (products.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">You might like instead</h2>
      <DeliverableProductGrid products={products} ratings={ratings} stock={stock} />
    </section>
  );
}
