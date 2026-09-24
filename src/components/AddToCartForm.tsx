"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/actions/cart";
import type { ProductVariant } from "@/types/database";

export default function AddToCartForm({
  variants,
  stock,
}: {
  variants: ProductVariant[];
  stock: Record<string, number>;
}) {
  const [variantId, setVariantId] = useState(
    variants.find((v) => v.is_default)?.id ?? variants[0]?.id
  );
  const [rawQuantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const available = stock[variantId] ?? 0;
  const inStock = available > 0;
  // Clamped at render time rather than synced via an effect: if the
  // selected variant changes to one with less stock, the displayed
  // quantity (and what actually gets added) should reflect that immediately.
  const quantity = Math.min(rawQuantity, Math.max(available, 1));

  function handleAdd() {
    setMessage(null);
    startTransition(async () => {
      try {
        await addToCart(variantId, quantity);
        setMessage("Added to cart.");
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Could not add to cart.");
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
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-neutral-300 text-neutral-600"
                }`}
              >
                {v.label}
              </button>
            );
          })}
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
              disabled={pending}
              className="w-full whitespace-nowrap rounded-full bg-emerald-600 px-6 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "Adding..." : "ADD TO CART"}
            </button>
          </div>

          {available <= 10 && <p className="text-sm text-amber-600">Only {available} left in stock</p>}
        </>
      ) : (
        <div className="rounded-lg bg-neutral-100 px-4 py-2 text-center text-sm font-medium text-neutral-500">
          Out of stock
        </div>
      )}

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
