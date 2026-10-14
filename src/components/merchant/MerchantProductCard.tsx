"use client";


import { unwrapAction } from "@/lib/errors";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMerchantProductActive, updateMerchantProduct, updateMerchantProductStock } from "@/lib/actions/merchant-products";
import StockCell from "@/components/admin/StockCell";
import ProductEditorModal from "@/components/admin/ProductEditorModal";

import { useLocale } from "@/components/LocaleProvider";
import type { Category } from "@/types/database";
import type { MerchantProduct } from "@/lib/merchant";
import { useMoney } from "@/components/MoneyProvider";

export default function MerchantProductCard({
  product,
  categories,
}: {
  product: MerchantProduct;
  categories: Category[];
}) {
  const money = useMoney();
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const variant = product.product_variants[0];
  const inv = variant?.inventory[0];

  return (
    <>
    {/* On a phone the card is a compact row (photo on the side); from tablet width up it is a card with the photo on top. */}
    <div className={`flex flex-row overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md sm:flex-col ${product.is_active ? "" : "opacity-80"}`}>
      <div className="flex w-24 shrink-0 items-center justify-center self-stretch bg-neutral-50 sm:h-36 sm:w-full sm:self-auto">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl sm:text-4xl">📦</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{product.name}</p>
            {product.brand && <p className="text-xs text-neutral-500">{product.brand}</p>}
          </div>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await unwrapAction(toggleMerchantProductActive)(product.id, !product.is_active);
                router.refresh();
              })
            }
            className={`inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-xs font-semibold disabled:opacity-50 ${
              product.is_active ? "bg-brand-50 text-brand-700" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {product.is_active ? t("product_card_admin.active") : t("product_card_admin.inactive")}
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5">{product.category?.name ?? t("product_card_admin.uncategorized")}</span>
          <span>{variant?.label}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">{variant ? money(variant.price) : "—"}</span>
          {variant?.compare_at_price != null && (
            <span className="text-xs text-neutral-500 line-through">{money(variant.compare_at_price)}</span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {inv ? (
            <StockCell
              inventoryId={inv.id}
              stock={inv.stock}
              minStock={inv.min_stock}
              updateAction={unwrapAction(updateMerchantProductStock)}
            />
          ) : (
            <span className="text-xs text-neutral-500">{t("product_card_admin.no_stock_row")}</span>
          )}
          <button
            onClick={() => setEditing(true)}
            className="inline-flex h-10 items-center rounded-full border border-neutral-300 px-4 text-sm font-semibold hover:bg-neutral-50 sm:h-9"
          >
            {t("addresses.edit")}
          </button>
        </div>
      </div>
    </div>
    {editing && variant && (
      <ProductEditorModal
        product={product}
        categories={categories}
        onClose={() => setEditing(false)}
        onSave={async (v) => {
          await unwrapAction(updateMerchantProduct)(product.id, variant.id, v);
          router.refresh();
        }}
      />
    )}
    </>
  );
}
