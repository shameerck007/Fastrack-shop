"use client";

import DeliverableProductGrid from "@/components/DeliverableProductGrid";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import type { ProductWithVariants } from "@/types/database";
import type { ProductRating } from "@/lib/reviews";

export default function ProductSection({
  title,
  products,
  ratings,
  stock,
  emptyMessage,
}: {
  title: string;
  products: ProductWithVariants[];
  ratings: Record<string, ProductRating>;
  stock: Record<string, number>;
  emptyMessage?: string;
}) {
  const { statusForStore } = useDeliveryLocation();

  // Only the "genuinely nothing here" case gets an explanatory message —
  // if products exist but are all outside the shopper's delivery area,
  // the section just disappears rather than showing an unrelated message.
  if (products.length === 0) {
    if (!emptyMessage) return null;
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        <p className="text-sm text-neutral-500">{emptyMessage}</p>
      </section>
    );
  }

  const anyVisible = products.some((p) => statusForStore(p.store_id).state !== "outside");
  if (!anyVisible) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <DeliverableProductGrid products={products} ratings={ratings} stock={stock} />
    </section>
  );
}
