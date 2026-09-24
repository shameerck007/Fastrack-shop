"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMerchantProductActive, updateMerchantProductStock } from "@/lib/actions/merchant-products";
import StockCell from "@/components/admin/StockCell";
import MerchantProductForm from "@/components/merchant/MerchantProductForm";
import { formatSAR } from "@/lib/utils";
import type { Category } from "@/types/database";
import type { MerchantProduct } from "@/lib/merchant";

export default function MerchantProductCard({
  product,
  categories,
}: {
  product: MerchantProduct;
  categories: Category[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const variant = product.product_variants[0];
  const inv = variant?.inventory[0];

  if (editing) {
    return (
      <div className="sm:col-span-2 lg:col-span-3">
        <MerchantProductForm categories={categories} existing={product} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex h-36 items-center justify-center bg-neutral-50">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-4xl">📦</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium leading-tight">{product.name}</p>
            {product.brand && <p className="text-xs text-neutral-400">{product.brand}</p>}
          </div>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await toggleMerchantProductActive(product.id, !product.is_active);
                router.refresh();
              })
            }
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs disabled:opacity-50 ${
              product.is_active ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {product.is_active ? "Active" : "Inactive"}
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5">{product.category?.name ?? "Uncategorized"}</span>
          <span>{variant?.label}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">{variant ? formatSAR(variant.price) : "—"}</span>
          {variant?.compare_at_price != null && (
            <span className="text-xs text-neutral-400 line-through">{formatSAR(variant.compare_at_price)}</span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {inv ? (
            <StockCell
              inventoryId={inv.id}
              stock={inv.stock}
              minStock={inv.min_stock}
              updateAction={updateMerchantProductStock}
            />
          ) : (
            <span className="text-xs text-neutral-400">No stock row</span>
          )}
          <button
            onClick={() => setEditing(true)}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-50"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
