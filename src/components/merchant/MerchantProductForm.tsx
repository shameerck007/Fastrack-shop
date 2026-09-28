"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMerchantProduct, updateMerchantProduct } from "@/lib/actions/merchant-products";
import ImageUploader from "@/components/ImageUploader";
import Modal from "@/components/Modal";
import type { Category } from "@/types/database";
import type { MerchantProduct } from "@/lib/merchant";
import { orderedCategories } from "@/lib/category-tree";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName } from "@/lib/i18n/localized";

const UNITS = ["unit", "kg", "g", "L", "ml", "pack"];

export default function MerchantProductForm({
  categories,
  existing,
  onDone,
}: {
  categories: Category[];
  existing?: MerchantProduct;
  onDone?: () => void;
}) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const existingVariant = existing?.product_variants[0];

  const [imageUrl, setImageUrl] = useState<string | null>(existing?.image_url ?? null);
  const [name, setName] = useState(existing?.name ?? "");
  const [brand, setBrand] = useState(existing?.brand ?? "");
  const [sku, setSku] = useState(existing?.sku ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? categories[0]?.id ?? "");
  const [variantLabel, setVariantLabel] = useState(existingVariant?.label ?? "1 unit");
  const [unit, setUnit] = useState(existingVariant?.unit ?? "unit");
  const [quantity, setQuantity] = useState(String(existingVariant?.quantity ?? 1));
  const [price, setPrice] = useState(existingVariant ? String(existingVariant.price) : "");
  const [compareAtPrice, setCompareAtPrice] = useState(
    existingVariant?.compare_at_price != null ? String(existingVariant.compare_at_price) : ""
  );
  const [stock, setStock] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function resetForm() {
    setImageUrl(null);
    setName("");
    setBrand("");
    setSku("");
    setDescription("");
    setPrice("");
    setCompareAtPrice("");
    setStock("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !price || (!existing && !stock) || !categoryId) {
      setError(t("product_form.fill_required"));
      return;
    }
    startTransition(async () => {
      try {
        if (existing && existingVariant) {
          await updateMerchantProduct(existing.id, existingVariant.id, {
            categoryId,
            name,
            brand: brand || undefined,
            sku: sku || undefined,
            description: description || undefined,
            imageUrl: imageUrl || undefined,
            price: Number(price),
            compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
            variantLabel,
            unit,
            quantity: Number(quantity) || 1,
          });
          onDone?.();
        } else {
          await createMerchantProduct({
            categoryId,
            name,
            brand: brand || undefined,
            sku: sku || undefined,
            description: description || undefined,
            imageUrl: imageUrl || undefined,
            price: Number(price),
            compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
            variantLabel,
            unit,
            quantity: Number(quantity) || 1,
            stock: Number(stock),
          });
          resetForm();
          setOpen(false);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("product_form.could_not_save"));
      }
    });
  }

  const formBody = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ImageUploader value={imageUrl} onChange={setImageUrl} />

      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder={t("product_form.product_name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder={t("product_form.brand")}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          {orderedCategories(categories).map((c) => (
            <option key={c.id} value={c.id}>
              {c.parent_id ? `↳ ${localizedName(c, locale)}` : localizedName(c, locale)}
            </option>
          ))}
        </select>
        <input
          placeholder={t("product_form.sku_optional")}
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <textarea
        placeholder={t("product_form.description_merchant_placeholder")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />

      <div className={`grid grid-cols-2 gap-3 ${existing ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        <input
          placeholder={t("product_form.variant_label")}
          value={variantLabel}
          onChange={(e) => setVariantLabel(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.001"
          placeholder={t("product_form.qty_per_unit")}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        {!existing && (
          <input
            type="number"
            step="0.001"
            placeholder={t("product_form.initial_stock")}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          step="0.01"
          placeholder={t("product_form.price_sar")}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.01"
          placeholder={t("product_form.compare_at_price_discount")}
          value={compareAtPrice}
          onChange={(e) => setCompareAtPrice(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {existing && (
        <p className="text-xs text-neutral-400">{t("product_form.stock_managed_separately")}</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("common.saving") : existing ? t("category_form.save_changes") : t("product_form.add_product")}
        </button>
        <button
          type="button"
          onClick={() => (existing ? onDone?.() : setOpen(false))}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );

  if (existing) {
    return <div className="rounded-xl border border-neutral-200 bg-white p-4">{formBody}</div>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 hover:shadow-md"
      >
        <span className="text-base leading-none">+</span> {t("product_form.add_product")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("product_form.add_a_new_product")}>
        {formBody}
      </Modal>
    </>
  );
}
