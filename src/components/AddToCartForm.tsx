"use client";


import { errorText, unwrapAction } from "@/lib/errors";
import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { addToCart } from "@/lib/actions/cart";
import { notifyCartChanged } from "@/lib/cart-events";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useLocale } from "@/components/LocaleProvider";
import { localizedField } from "@/lib/i18n/localized";
import { useVariantSelection } from "@/components/ProductVariantProvider";
import type { ProductVariant } from "@/types/database";
import MapPinIcon from "@/components/MapPinIcon";

export default function AddToCartForm({
  variants,
  stock,
  isLoggedIn,
  storeId,
  maxQty = null,
}: {
  variants: ProductVariant[];
  stock: Record<string, number>;
  isLoggedIn: boolean;
  storeId: string | null;
  /** The product's per-order limit, if it has one. */
  maxQty?: number | null;
}) {
  // The selected pack size lives in ProductVariantProvider, so the prices at the top of the page follow it.
  const { variantId: selectedId, setVariantId } = useVariantSelection();
  const variantId = selectedId ?? variants[0]?.id;
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

  const inStock = (stock[variantId] ?? 0) > 0;
  // What one order can hold: what is in stock, or the product's per-order limit if that is lower.
  const available = maxQty !== null ? Math.min(stock[variantId] ?? 0, maxQty) : (stock[variantId] ?? 0);
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
        const result = await unwrapAction(addToCart)(variantId, quantity, location ? { lat: location.lat, lng: location.lng } : undefined);
        if (result.error) {
          setMessage(result.error);
          return;
        }
        setMessage(t("product.added_to_cart"));
        notifyCartChanged();
      } catch (err) {
        setMessage(errorText(err, t("product.could_not_add")));
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
                    ? "border-brand-600 bg-brand-50 text-brand-700"
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
        <button
          type="button"
          onClick={openPicker}
          className="flex w-full items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-start text-sm font-medium text-brand-800 transition hover:bg-brand-100"
        >
          <MapPinIcon />
          <span className="flex-1">{t("product.choose_delivery_location")}</span>
        </button>
      )}

      {inStock ? (
        <>
          <div className="flex items-center gap-3 md:flex-col md:items-stretch md:gap-2">
            <div className="flex items-center self-start rounded-full border border-neutral-300 max-md:self-auto">
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
              className="w-full flex-1 whitespace-nowrap rounded-full bg-brand-700 px-6 py-3 font-bold text-white hover:bg-brand-800 disabled:opacity-50 md:py-2 md:font-medium"
            >
              {pending ? t("product.adding") : t("product.add_to_cart")}
            </button>
          </div>

          {maxQty !== null && <p className="text-sm font-medium text-amber-700">{t("product.limit_per_order", { count: maxQty })}</p>}
          {(stock[variantId] ?? 0) <= 10 && (
            <p className="text-sm text-amber-600">{t("product.only_left_in_stock", { count: stock[variantId] ?? 0 })}</p>
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
