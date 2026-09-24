"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/actions/cart";
import type { ProductVariant, SubstitutionPreference } from "@/types/database";

export default function AddToCartForm({
  variants,
  isFresh,
}: {
  variants: ProductVariant[];
  isFresh: boolean;
}) {
  const [variantId, setVariantId] = useState(
    variants.find((v) => v.is_default)?.id ?? variants[0]?.id
  );
  const [quantity, setQuantity] = useState(1);
  const [substitution, setSubstitution] = useState<SubstitutionPreference>("allow");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleAdd() {
    setMessage(null);
    startTransition(async () => {
      try {
        await addToCart(variantId, quantity, substitution);
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
          {variants.map((v) => (
            <button
              key={v.id}
              onClick={() => setVariantId(v.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                variantId === v.id
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-neutral-300 text-neutral-600"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center self-start rounded-full border border-neutral-300">
          <button
            className="px-3 py-1 text-lg"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span className="w-8 text-center">{quantity}</span>
          <button className="px-3 py-1 text-lg" onClick={() => setQuantity((q) => q + 1)}>
            +
          </button>
        </div>

        <button
          onClick={handleAdd}
          disabled={pending || !variantId}
          className="w-full whitespace-nowrap rounded-full bg-emerald-600 px-6 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "Adding..." : "ADD TO CART"}
        </button>
      </div>

      {isFresh && (
        <div>
          <p className="mb-1 text-sm font-medium text-neutral-700">
            If this item is unavailable:
          </p>
          <div className="flex flex-col gap-1 text-sm">
            {[
              { value: "allow", label: "Allow substitution" },
              { value: "contact_me", label: "Contact me before substitution" },
              { value: "refund", label: "Refund unavailable item" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="substitution"
                  checked={substitution === opt.value}
                  onChange={() => setSubstitution(opt.value as SubstitutionPreference)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
