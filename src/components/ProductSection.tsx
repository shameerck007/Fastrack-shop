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
  id,
  promo,
}: {
  title: string;
  products: ProductWithVariants[];
  ratings: Record<string, ProductRating>;
  stock: Record<string, number>;
  emptyMessage?: string;
  id?: string;
  promo?: boolean;
}) {
  const { statusForStore } = useDeliveryLocation();

  // Only the "genuinely nothing here" case gets an explanatory message —
  // if products exist but are all outside the shopper's delivery area,
  // the section just disappears rather than showing an unrelated message.
  if (products.length === 0) {
    if (!emptyMessage) return null;
    return (
      <section id={id} className="mb-8 scroll-mt-40">
        <h2 className="mb-3 text-xl font-extrabold tracking-tight">{title}</h2>
        <p className="text-sm text-neutral-500">{emptyMessage}</p>
      </section>
    );
  }

  const anyVisible = products.some((p) => statusForStore(p.store_id).state !== "outside");
  if (!anyVisible) return null;

  return (
    <section
      id={id}
      className={`mb-8 scroll-mt-40 ${promo ? "-mx-4 rounded-3xl bg-amber-50 px-4 py-5 sm:mx-0 sm:px-5" : ""}`}
    >
      <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold tracking-tight">
        <span aria-hidden className="h-5 w-1.5 rounded-full bg-amber-400" />
        {title}
      </h2>
      <DeliverableProductGrid products={products} ratings={ratings} stock={stock} />
    </section>
  );
}
