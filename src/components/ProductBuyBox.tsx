"use client";

import AddToCartForm from "@/components/AddToCartForm";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import type { ProductVariant } from "@/types/database";

export default function ProductBuyBox({
  storeId,
  variants,
  stock,
  isLoggedIn,
}: {
  storeId: string | null;
  variants: ProductVariant[];
  stock: Record<string, number>;
  isLoggedIn: boolean;
}) {
  const { statusForStore, location, openPicker } = useDeliveryLocation();
  const status = statusForStore(storeId);

  if (status.state === "outside") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="mb-1 text-2xl">📍</p>
        <p className="font-medium text-neutral-900">
          Not available in {location?.label ?? "your area"} yet
        </p>
        <p className="mt-1 text-neutral-600">
          This seller currently delivers within {status.radiusKm} km, and you&apos;re about{" "}
          {status.distanceKm.toFixed(1)} km away.
        </p>
        <button
          onClick={openPicker}
          className="mt-3 w-full rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Change delivery location
        </button>
      </div>
    );
  }

  return (
    <AddToCartForm variants={variants} stock={stock} isLoggedIn={isLoggedIn} storeId={storeId} />
  );
}
