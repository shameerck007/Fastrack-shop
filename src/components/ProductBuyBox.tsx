"use client";

import AddToCartForm from "@/components/AddToCartForm";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useLocale } from "@/components/LocaleProvider";
import { useStoreInfo } from "@/components/StoreDirectoryProvider";
import { StatusPill } from "@/components/StoreBadge";
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
  const { t } = useLocale();
  const status = statusForStore(storeId);
  const { store, status: openStatus } = useStoreInfo(storeId);

  if (store && openStatus && !openStatus.open) {
    return (
      <div className="rounded-xl bg-neutral-100 p-4 text-sm">
        <StatusPill status={openStatus} className="mb-2" />
        <p className="text-neutral-700">
          {openStatus.reason === "paused"
            ? t("store.paused_notice", { name: store.name })
            : t("store.closed_notice", { name: store.name })}
        </p>
      </div>
    );
  }

  if (status.state === "outside") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="mb-1 text-2xl">📍</p>
        <p className="font-medium text-neutral-900">
          {t("product.not_available_in", { area: location?.label ?? "—" })}
        </p>
        <p className="mt-1 text-neutral-600">
          {t("product.delivers_within", { radius: status.radiusKm, distance: status.distanceKm.toFixed(1) })}
        </p>
        <button
          onClick={openPicker}
          className="mt-3 w-full rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          {t("header.change_location")}
        </button>
      </div>
    );
  }

  return (
    <AddToCartForm variants={variants} stock={stock} isLoggedIn={isLoggedIn} storeId={storeId} />
  );
}
