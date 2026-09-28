"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { addToCart } from "@/lib/actions/cart";
import { notifyCartChanged } from "@/lib/cart-events";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useLocale } from "@/components/LocaleProvider";
import { localizedField } from "@/lib/i18n/localized";
import type { ProductVariant } from "@/types/database";

export default function AddToCartForm({
  variants,
  stock,
  isLoggedIn,
  storeId,
}: {
  variants: ProductVariant[];
  stock: Record<string, number>;
  isLoggedIn: boolean;
  storeId: string | null;
}) {
  const [variantId, setVariantId] = useState(
    variants.find((v) => v.is_default)?.id ?? variants[0]?.id
  );
  const [rawQuantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale } = useLocale();
  const { location, statusForStore, openPicker } = useDeliveryLocation();
  // "outside" is handled by ProductBuyBox before this form ever renders —
  // this only needs to cover "we don't know your location yet" for stores
  // that do have a delivery boundary set.
  const needsLocation = statusForStore(storeId).state === "no_location";

  const available = stock[variantId] ?? 0;
  const inStock = available > 0;
  // Clamped at render time rather than synced via an effect: if the
  // selected variant changes to one with less stock, the displayed
  // quantity (and what actually gets added) should reflect that immediately.
  const quantity = Math.min(rawQuantity, Math.max(available, 1));

  function handleAdd() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        await addToCart(variantId, quantity, location ? { lat: location.lat, lng: location.lng } : undefined);
        setMessage(t("product.added_to_cart"));
        notifyCartChanged();
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : t("product.could_not_add"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {variants.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const variantInStock = (stock[v.id] ?? 0) > 0;
            return (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                disabled={!variantInStock}
                className={`rounded-full border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                  variantId === v.id
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-neutral-300 text-neutral-600"
                }`}
              >
                {localizedField(v.label, v.label_ar, locale)}
              </button>
            );
          })}
        </div>
      )}

      {needsLocation && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <p className="font-medium">{t("product.set_delivery_location")}</p>
          <p>{t("product.delivery_area_hint")}</p>
          <button onClick={openPicker} className="mt-1 inline-block font-medium text-blue-700 hover:underline">
            {t("product.choose_delivery_location")}
          </button>
        </div>
      )}

      {inStock ? (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center self-start rounded-full border border-neutral-300">
              <button
                className="px-3 py-1 text-lg disabled:opacity-40"
                disabled={quantity <= 1}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                −
              </button>
              <span className="w-8 text-center">{quantity}</span>
              <button
                className="px-3 py-1 text-lg disabled:opacity-40"
                disabled={quantity >= available}
                onClick={() => setQuantity(Math.min(available, quantity + 1))}
              >
                +
              </button>
            </div>

            <button
              onClick={handleAdd}
              disabled={pending || needsLocation}
              className="w-full whitespace-nowrap rounded-full bg-blue-700 px-6 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {pending ? t("product.adding") : t("product.add_to_cart")}
            </button>
          </div>

          {available <= 10 && (
            <p className="text-sm text-amber-600">{t("product.only_left_in_stock", { count: available })}</p>
          )}
        </>
      ) : (
        <div className="rounded-lg bg-neutral-100 px-4 py-2 text-center text-sm font-medium text-neutral-500">
          {t("product.out_of_stock")}
        </div>
      )}

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
