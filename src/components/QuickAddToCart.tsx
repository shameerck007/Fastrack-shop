"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { addToCart } from "@/lib/actions/cart";
import { notifyCartChanged } from "@/lib/cart-events";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useLocale } from "@/components/LocaleProvider";

/** Amazon-style quick add: a floating "+" on the product card that adds one
 * unit of the default variant without leaving the listing — no trip to the
 * product detail page needed for the common case of "just add it".
 *
 * Deliberately additive-only (each tap calls the same `addToCart` the
 * product page uses, +1 at a time) rather than a stepper that tracks and
 * sets an absolute quantity: this component has no reliable way to know
 * what's already in the cart for this variant when it mounts (that would
 * need a cart-quantity map threaded through every listing page), so a
 * "set exact quantity" control here could silently overwrite — e.g.
 * clobber an existing quantity of 3 down to 1. Adding is always safe. */
export default function QuickAddToCart({
  variantId,
  storeId,
  stock,
}: {
  variantId: string;
  storeId: string | null;
  stock: number;
}) {
  const [pending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLocale();
  const { location, statusForStore, openPicker } = useDeliveryLocation();

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(false), 1200);
    return () => clearTimeout(timer);
  }, [justAdded]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 2500);
    return () => clearTimeout(timer);
  }, [error]);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (statusForStore(storeId).state === "no_location") {
      openPicker();
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addToCart(variantId, 1, location ? { lat: location.lat, lng: location.lng } : undefined);
        notifyCartChanged();
        setJustAdded(true);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.toLowerCase().includes("logged in")) {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        } else {
          setError(msg || t("product.could_not_add"));
        }
      }
    });
  }

  return (
    <div className="absolute bottom-2 end-2 z-10">
      <button
        type="button"
        onClick={handleAdd}
        disabled={pending || stock <= 0}
        aria-label={t("product.add_to_cart")}
        title={t("product.add_to_cart")}
        className={`flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold text-white shadow-md transition active:scale-95 disabled:opacity-50 ${
          justAdded ? "bg-emerald-600" : "bg-blue-700 hover:bg-blue-800"
        }`}
      >
        {pending ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : justAdded ? (
          "✓"
        ) : (
          "+"
        )}
      </button>
      {error && (
        <span className="absolute top-full mt-1 w-max max-w-[10rem] whitespace-normal rounded bg-neutral-900 px-2 py-1 text-[10px] text-white shadow-lg end-0">
          {error}
        </span>
      )}
    </div>
  );
}
