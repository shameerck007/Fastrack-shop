"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateCartItemQuantity, removeCartItem } from "@/lib/actions/cart";
import { notifyCartChanged } from "@/lib/cart-events";
import { formatSAR } from "@/lib/utils";
import type { CartItemWithVariant } from "@/types/database";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName, localizedField } from "@/lib/i18n/localized";

export default function CartItemRow({ item }: { item: CartItemWithVariant }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { t, locale } = useLocale();
  const variant = item.product_variants;
  const product = variant.products;
  const name = localizedName(product, locale);

  function updateQuantity(quantity: number) {
    setError(null);
    startTransition(async () => {
      try {
        await updateCartItemQuantity(item.id, quantity);
        notifyCartChanged();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("cart.could_not_update_quantity"));
      }
    });
  }

  function remove() {
    startTransition(async () => {
      await removeCartItem(item.id);
      notifyCartChanged();
      router.refresh();
    });
  }

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
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-full border border-neutral-300">
            <button
              className="px-3 py-1 text-base disabled:opacity-40"
              disabled={pending}
              onClick={() => updateQuantity(item.quantity - 1)}
            >
              −
            </button>
            <span className="w-8 text-center text-sm">{item.quantity}</span>
            <button
              className="px-3 py-1 text-base disabled:opacity-40"
              disabled={pending}
              onClick={() => updateQuantity(item.quantity + 1)}
            >
              +
            </button>
          </div>
          <span className="h-4 w-px bg-neutral-200" />
          <button
            onClick={remove}
            disabled={pending}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-40"
          >
            {t("cart.remove")}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>

      <div className="shrink-0 text-end font-semibold text-neutral-900">
        {formatSAR(item.quantity * variant.price)}
      </div>
    </div>
  );
}
