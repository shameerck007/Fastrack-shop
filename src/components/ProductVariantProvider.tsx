"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useMoney } from "@/components/MoneyProvider";
import type { ProductVariant } from "@/types/database";

interface Ctx {
  variants: ProductVariant[];
  variantId: string | undefined;
  setVariantId: (id: string) => void;
  variant: ProductVariant | undefined;
}

const VariantContext = createContext<Ctx | null>(null);

/** Holds the pack size the shopper has picked on a product page, so the price, the discount and the Add to cart button all follow it. */
export default function ProductVariantProvider({ variants, children }: { variants: ProductVariant[]; children: React.ReactNode }) {
  const [variantId, setVariantId] = useState<string | undefined>(variants.find((v) => v.is_default)?.id ?? variants[0]?.id);
  const value = useMemo<Ctx>(() => ({ variants, variantId, setVariantId, variant: variants.find((v) => v.id === variantId) ?? variants[0] }), [variants, variantId]);
  return <VariantContext.Provider value={value}>{children}</VariantContext.Provider>;
}

export function useVariantSelection(): Ctx {
  const ctx = useContext(VariantContext);
  if (!ctx) throw new Error("useVariantSelection must be used inside ProductVariantProvider");
  return ctx;
}

/** The price of the pack size that is selected, with its crossed-out old price and the saving. */
export function SelectedPrice({ className = "", compareClassName = "text-neutral-500 line-through", showSaving = false }: { className?: string; compareClassName?: string; showSaving?: boolean }) {
  const money = useMoney();
  const { variant } = useVariantSelection();
  const off = variant?.compare_at_price && variant.compare_at_price > variant.price ? Math.round((1 - variant.price / variant.compare_at_price) * 100) : 0;
  return (
    <>
      <span className={className}>{variant ? money(variant.price) : "—"}</span>
      {variant?.compare_at_price ? <span className={compareClassName}>{money(variant.compare_at_price)}</span> : null}
      {showSaving && off > 0 ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">-{off}%</span> : null}
    </>
  );
}
