"use client";

import { useState, useTransition } from "react";
import OrderLimitField from "@/components/admin/OrderLimitField";
import TaxFields from "@/components/admin/TaxFields";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct } from "@/lib/actions/admin-products";
import ImageUploader from "@/components/ImageUploader";
import Modal from "@/components/Modal";
import type { Category, Warehouse } from "@/types/database";
import type { AdminProduct } from "@/lib/admin-products";
import { orderedCategories } from "@/lib/category-tree";
import { useLocale } from "@/components/LocaleProvider";
import { useCurrency, useDefaultMaxQty } from "@/components/MoneyProvider";
import { localizedName } from "@/lib/i18n/localized";
import Select from "@/components/ui/Select";
import ArabicInput from "@/components/ui/ArabicInput";

const UNITS = ["unit", "kg", "g", "L", "ml", "pack"];

export default function ProductForm({
  categories,
  warehouses,
  existing,
  onDone,
}: {
  categories: Category[];
  warehouses: Warehouse[];
  existing?: AdminProduct;
  onDone?: () => void;
}) {
  const { t, locale } = useLocale();
  const defaultMaxQty = useDefaultMaxQty();
  const currency = useCurrency();
  const [open, setOpen] = useState(false);
  const existingVariant = existing?.product_variants[0];

  const [imageUrl, setImageUrl] = useState<string | null>(existing?.image_url ?? null);
  const [name, setName] = useState(existing?.name ?? "");
  const [nameAr, setNameAr] = useState(existing?.name_ar ?? "");
  const [brand, setBrand] = useState(existing?.brand ?? "");
  const [brandAr, setBrandAr] = useState(existing?.brand_ar ?? "");
  const [sku, setSku] = useState(existing?.sku ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [descriptionAr, setDescriptionAr] = useState(existing?.description_ar ?? "");
  const [taxRate, setTaxRate] = useState(existing?.tax_rate != null ? String(existing.tax_rate) : "");
  const [hsnCode, setHsnCode] = useState(existing?.hsn_code ?? "");
  const [maxOrderQty, setMaxOrderQty] = useState(String(existing?.max_order_qty ?? defaultMaxQty));
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? categories[0]?.id ?? "");
  const [variantLabel, setVariantLabel] = useState(existingVariant?.label ?? "1 unit");
  const [variantLabelAr, setVariantLabelAr] = useState(existingVariant?.label_ar ?? "");
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
    setNameAr("");
    setBrand("");
    setBrandAr("");
    setSku("");
    setDescription("");
    setDescriptionAr("");
    setVariantLabelAr("");
    setMaxOrderQty(String(defaultMaxQty));
    setPrice("");
    setCompareAtPrice("");
    setStock("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !price || (!existing && !stock) || !categoryId || (!existing && !warehouses[0])) {
      setError(t("product_form.fill_required"));
      return;
    }
    if (!Number.isInteger(Number(maxOrderQty)) || !(Number(maxOrderQty) >= 1)) {
      setError("Enter the maximum order quantity: a whole number of 1 or more.");
      return;
    }
    startTransition(async () => {
      try {
        if (existing && existingVariant) {
          await updateProduct(existing.id, existingVariant.id, {
            categoryId,
            name,
            nameAr: nameAr || undefined,
            brand: brand || undefined,
            brandAr: brandAr || undefined,
            sku: sku || undefined,
            description: description || undefined,
            descriptionAr: descriptionAr || undefined,
            imageUrl: imageUrl || undefined,
            taxRate: taxRate === "" ? null : Number(taxRate),
            hsnCode: hsnCode || undefined,
            maxOrderQty: Number(maxOrderQty),
            price: Number(price),
            compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
            variantLabel,
            variantLabelAr: variantLabelAr || undefined,
            unit,
            quantity: Number(quantity) || 1,
          });
          onDone?.();
        } else {
          await createProduct({
            categoryId,
            name,
            nameAr: nameAr || undefined,
            brand: brand || undefined,
            brandAr: brandAr || undefined,
            sku: sku || undefined,
            description: description || undefined,
            descriptionAr: descriptionAr || undefined,
            imageUrl: imageUrl || undefined,
            taxRate: taxRate === "" ? null : Number(taxRate),
            hsnCode: hsnCode || undefined,
            maxOrderQty: Number(maxOrderQty),
            price: Number(price),
            compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
            variantLabel,
            variantLabelAr: variantLabelAr || undefined,
            unit,
            quantity: Number(quantity) || 1,
            stock: Number(stock),
            warehouseId: warehouses[0].id,
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
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <ArabicInput english={name} value={nameAr} onChange={setNameAr} placeholder={t("product_form.name_ar_placeholder")} className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <input
          placeholder={t("product_form.brand")}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <ArabicInput english={brand} value={brandAr} onChange={setBrandAr} placeholder={t("product_form.brand_ar_placeholder")} className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          {orderedCategories(categories).map((c) => (
            <option key={c.id} value={c.id}>
              {c.parent_id ? `↳ ${localizedName(c, locale)}` : localizedName(c, locale)}
            </option>
          ))}
        </Select>
        <input
          placeholder={t("product_form.sku_optional")}
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <textarea
        placeholder={t("product_form.description_optional")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      <ArabicInput english={description} value={descriptionAr} onChange={setDescriptionAr} placeholder={t("product_form.description_ar_placeholder")} className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" multiline rows={3} />

      <div className={`grid grid-cols-2 gap-3 ${existing ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        <input
          placeholder={t("product_form.variant_label")}
          value={variantLabel}
          onChange={(e) => setVariantLabel(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <ArabicInput english={variantLabel} value={variantLabelAr} onChange={setVariantLabelAr} placeholder={t("product_form.variant_label_ar_placeholder")} className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" compact />
        <Select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
        <input
          type="number"
          step="0.001"
          placeholder={t("product_form.qty_per_unit")}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {!existing && (
          <input
            type="number"
            step="0.001"
            placeholder={t("product_form.initial_stock")}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          step="0.01"
          placeholder={t("product_form.price_sar", { currency })}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          type="number"
          step="0.01"
          placeholder={t("product_form.compare_at_price")}
          value={compareAtPrice}
          onChange={(e) => setCompareAtPrice(e.target.value)}
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <TaxFields taxRate={taxRate} onTaxRate={setTaxRate} hsnCode={hsnCode} onHsnCode={setHsnCode} />

      <OrderLimitField value={maxOrderQty} onChange={setMaxOrderQty} />

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
