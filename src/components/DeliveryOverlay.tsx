"use client";

import { useDeliveryLocation } from "@/components/delivery-location-context";

/** Dims a product card image when the seller can't deliver to the shopper's location. */
export default function DeliveryOverlay({ storeId }: { storeId: string | null }) {
  const { statusForStore } = useDeliveryLocation();
  if (statusForStore(storeId).state !== "outside") return null;

  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-neutral-900/45 pb-2">
      <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold text-red-600 shadow-sm">
        Not deliverable to you
      </span>
    </div>
  );
}
