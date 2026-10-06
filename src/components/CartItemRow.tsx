"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/Link";
import { updateCartItemQuantity, removeCartItem } from "@/lib/actions/cart";
import { notifyCartChanged, refreshSoon } from "@/lib/cart-events";

import type { CartItemWithVariant } from "@/types/database";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName, localizedField } from "@/lib/i18n/localized";
import { useMoney } from "@/components/MoneyProvider";

export default function CartItemRow({
  item,
  undeliverable = false,
}: {
  item: CartItemWithVariant;
  /** True when none of the shopper's saved, pinned addresses can receive
   * this item — flagged here so it's never a surprise first seen at
   * checkout (e.g. it was added while browsing from a location that
   * doesn't match any saved address). */
  undeliverable?: boolean;
}) {
  const money = useMoney();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // Shown at once on tap; the real totals arrive with one refresh after the taps stop.
  const [optimisticQty, setOptimisticQty] = useState<number | null>(null);
  const [removed, setRemoved] = useState(false);
  useEffect(() => setOptimisticQty(null), [item.quantity]);
  const quantity = optimisticQty ?? item.quantity;
  const { t, locale } = useLocale();
  const variant = item.product_variants;
  const product = variant.products;
  const name = localizedName(product, locale);

  function updateQuantity(quantity: number) {
    setError(null);
    if (quantity <= 0) setRemoved(true);
    else setOptimisticQty(quantity);
    startTransition(async () => {
      try {
        await updateCartItemQuantity(item.id, quantity);
        notifyCartChanged();
        refreshSoon(() => router.refresh());
      } catch (err) {
        setRemoved(false);
        setOptimisticQty(null);
        setError(err instanceof Error ? err.message : t("cart.could_not_update_quantity"));
      }
    });
  }

  function remove() {
    setRemoved(true);
    startTransition(async () => {
      try {
        await removeCartItem(item.id);
        notifyCartChanged();
        refreshSoon(() => router.refresh());
      } catch {
        setRemoved(false);
      }
    });
  }

  if (removed) return null;

  return (
    <div className="flex gap-4 border-b border-neutral-200 py-4 last:border-none">
      <Link href={`/products/${product.id}`} className="shrink-0">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 sm:h-28 sm:w-28">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl">📦</span>
          )}
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <Link href={`/products/${product.id}`} className="font-medium text-neutral-900 hover:text-blue-700 hover:underline">
            {name}
          </Link>
          {product.brand && <p className="text-xs text-neutral-400">{localizedField(product.brand, product.brand_ar, locale)}</p>}
          <p className="text-sm text-neutral-500">{localizedField(variant.label, variant.label_ar, locale)}</p>
          {undeliverable && (
            <p className="mt-1 text-xs font-medium text-red-600">{t("cart.item_not_deliverable")}</p>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-full border border-neutral-300">
            <button
              className="px-3 py-1 text-base disabled:opacity-40"
              disabled={pending}
              onClick={() => updateQuantity(quantity - 1)}
            >
              −
            </button>
            <span className="w-8 text-center text-sm">{quantity}</span>
            <button
              className="px-3 py-1 text-base disabled:opacity-40"
              disabled={pending}
              onClick={() => updateQuantity(quantity + 1)}
            >
              +
            </button>
          </div>
          <span className="h-4 w-px bg-neutral-200" />
          <button
            onClick={remove}
            disabled={pending}
            className={`text-sm hover:underline disabled:opacity-40 ${
              undeliverable ? "font-medium text-red-600 hover:text-red-800" : "text-blue-600 hover:text-blue-800"
            }`}
          >
            {t("cart.remove")}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>

      <div className="shrink-0 text-end font-semibold text-neutral-900">
        {money(quantity * variant.price)}
      </div>
    </div>
  );
}
