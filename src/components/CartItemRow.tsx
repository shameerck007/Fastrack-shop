"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCartItemQuantity, removeCartItem } from "@/lib/actions/cart";
import { formatSAR } from "@/lib/utils";
import type { CartItemWithVariant } from "@/types/database";

export default function CartItemRow({ item }: { item: CartItemWithVariant }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const variant = item.product_variants;
  const product = variant.products;

  function updateQuantity(quantity: number) {
    startTransition(async () => {
      await updateCartItemQuantity(item.id, quantity);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await removeCartItem(item.id);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-200 py-3">
      <div>
        <p className="font-medium">{product.name}</p>
        <p className="text-sm text-neutral-500">{variant.label}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-full border border-neutral-300">
          <button
            className="px-2 py-1"
            disabled={pending}
            onClick={() => updateQuantity(item.quantity - 1)}
          >
            −
          </button>
          <span className="w-6 text-center text-sm">{item.quantity}</span>
          <button
            className="px-2 py-1"
            disabled={pending}
            onClick={() => updateQuantity(item.quantity + 1)}
          >
            +
          </button>
        </div>

        <span className="w-20 text-right font-medium">
          {formatSAR(item.quantity * variant.price)}
        </span>

        <button
          onClick={remove}
          disabled={pending}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
