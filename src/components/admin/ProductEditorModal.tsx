"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import ImageUploader from "@/components/ImageUploader";
import Select from "@/components/ui/Select";
import ArabicInput from "@/components/ui/ArabicInput";
import TaxFields from "@/components/admin/TaxFields";
import OrderLimitField from "@/components/admin/OrderLimitField";
import { Field, inputClass, primaryButton, secondaryButton, textareaClass } from "@/components/ui/Form";
import { useCurrency, useDefaultMaxQty, useMoney } from "@/components/MoneyProvider";
import { useLocale } from "@/components/LocaleProvider";
import { orderedCategories } from "@/lib/category-tree";
import { localizedName } from "@/lib/i18n/localized";
import type { Category } from "@/types/database";

const UNITS = ["unit", "kg", "g", "L", "ml", "pack"];

/** What the editor needs to know about a product (admin and supplier products share this shape). */
export interface EditableProduct {
  id: string;
  name: string;
  name_ar: string | null;
  brand: string | null;
  brand_ar: string | null;
  sku: string | null;
  description: string | null;
  description_ar: string | null;
  tax_rate?: number | null;
  hsn_code?: string | null;
  max_order_qty?: number | null;
  image_url: string | null;
  is_active: boolean;
  category_id: string | null;
  category: { name: string } | null;
  product_variants: {
    id: string;
    label: string;
    label_ar: string | null;
    unit: string;
    quantity: number;
    price: number;
    compare_at_price: number | null;
    inventory: { stock: number; min_stock: number }[];
  }[];
}

/** What is saved: the same fields the update actions take. */
export interface EditorValues {
  categoryId: string;
  name: string;
  nameAr?: string;
  brand?: string;
  brandAr?: string;
  sku?: string;
  description?: string;
  descriptionAr?: string;
  imageUrl?: string;
  taxRate: number | null;
  hsnCode?: string;
  maxOrderQty: number;
  price: number;
  compareAtPrice?: number;
  variantLabel: string;
  variantLabelAr?: string;
  unit: string;
  quantity: number;
}

function Section({ icon, title, hint, children }: { icon: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-base">{icon}</span>
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-neutral-900">{title}</h3>
          {hint && <p className="text-xs text-neutral-500">{hint}</p>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Edit a product in a popup: photo and headline facts on the left, the details in clear sections on the right. */
export default function ProductEditorModal({
  product,
  categories,
  onSave,
  onClose,
}: {
  product: EditableProduct;
  categories: Category[];
  onSave: (values: EditorValues) => Promise<void>;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const currency = useCurrency();
  const money = useMoney();
  const defaultMaxQty = useDefaultMaxQty();
  const variant = product.product_variants[0];
  const inv = variant?.inventory[0];

  const [imageUrl, setImageUrl] = useState<string | null>(product.image_url);
  const [name, setName] = useState(product.name);
  const [nameAr, setNameAr] = useState(product.name_ar ?? "");
  const [brand, setBrand] = useState(product.brand ?? "");
  const [brandAr, setBrandAr] = useState(product.brand_ar ?? "");
  const [sku, setSku] = useState(product.sku ?? "");
  const [categoryId, setCategoryId] = useState(product.category_id ?? categories[0]?.id ?? "");
  const [description, setDescription] = useState(product.description ?? "");
  const [descriptionAr, setDescriptionAr] = useState(product.description_ar ?? "");
  const [variantLabel, setVariantLabel] = useState(variant?.label ?? "1 unit");
  const [variantLabelAr, setVariantLabelAr] = useState(variant?.label_ar ?? "");
  const [unit, setUnit] = useState(variant?.unit ?? "unit");
  const [quantity, setQuantity] = useState(String(variant?.quantity ?? 1));
  const [price, setPrice] = useState(variant ? String(variant.price) : "");
  const [compareAt, setCompareAt] = useState(variant?.compare_at_price != null ? String(variant.compare_at_price) : "");
  const [taxRate, setTaxRate] = useState(product.tax_rate != null ? String(product.tax_rate) : "");
  const [hsnCode, setHsnCode] = useState(product.hsn_code ?? "");
  const [maxOrderQty, setMaxOrderQty] = useState(String(product.max_order_qty ?? defaultMaxQty));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const priceNum = Number(price);
  const compareNum = Number(compareAt);
  const offPct = compareNum > priceNum && priceNum > 0 ? Math.round((1 - priceNum / compareNum) * 100) : 0;
  const categoryName = categories.find((c) => c.id === categoryId);
  const low = inv ? inv.stock < inv.min_stock : false;

  function save() {
    setError(null);
    if (!name.trim()) return setError("Enter the product name.");
    if (!categoryId) return setError("Choose a category.");
    if (!(priceNum > 0)) return setError("Enter a price above zero.");
    if (!Number.isInteger(Number(maxOrderQty)) || !(Number(maxOrderQty) >= 1)) return setError("Enter the maximum order quantity: a whole number of 1 or more.");
    start(async () => {
      try {
        await onSave({
          categoryId,
          name: name.trim(),
          nameAr: nameAr.trim() || undefined,
          brand: brand.trim() || undefined,
          brandAr: brandAr.trim() || undefined,
          sku: sku.trim() || undefined,
          description: description.trim() || undefined,
          descriptionAr: descriptionAr.trim() || undefined,
          imageUrl: imageUrl || undefined,
          taxRate: taxRate === "" ? null : Number(taxRate),
          hsnCode: hsnCode || undefined,
          maxOrderQty: Number(maxOrderQty),
          price: priceNum,
          compareAtPrice: compareNum > 0 ? compareNum : undefined,
          variantLabel: variantLabel.trim() || "1 unit",
          variantLabelAr: variantLabelAr.trim() || undefined,
          unit,
          quantity: Number(quantity) || 1,
        });
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the product.");
      }
    });
  }

  return (
    <Modal open onClose={onClose} size="xl">
      <div className="-m-5 flex flex-col">
        {/* header */}
        <div className="flex items-center gap-4 border-b border-neutral-100 bg-gradient-to-r from-blue-50 via-white to-white px-5 py-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl">📦</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Edit product</p>
            <h2 className="truncate text-lg font-extrabold tracking-tight text-neutral-900">{name || "Untitled product"}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              {categoryName && <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-600">{localizedName(categoryName, locale)}</span>}
              <span className={`rounded-full px-2 py-0.5 font-semibold ${product.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>{product.is_active ? "Active" : "Inactive"}</span>
              {variant && <span className="text-neutral-500">{variant.label}</span>}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700">
            ✕
          </button>
        </div>

        {/* body */}
        <div className="grid gap-4 bg-neutral-50 p-4 sm:p-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">Photo</p>
              <ImageUploader value={imageUrl} onChange={setImageUrl} />
            </section>
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-400">At a glance</p>
              <dl className="grid gap-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-neutral-500">Price</dt>
                  <dd className="text-right">
                    <b className="text-neutral-900">{priceNum > 0 ? money(priceNum) : "—"}</b>
                    {offPct > 0 && <span className="ms-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">{offPct}% off</span>}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-neutral-500">In stock</dt>
                  <dd className={`font-bold ${low ? "text-rose-600" : "text-neutral-900"}`}>{inv ? `${inv.stock}${low ? " · low" : ""}` : "—"}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-neutral-500">Order limit</dt>
                  <dd className="font-bold text-neutral-900">{maxOrderQty || "—"} per order</dd>
                </div>
              </dl>
              <p className="mt-3 border-t border-neutral-100 pt-2 text-[11px] text-neutral-400">Stock is changed on the product card, so counts never get overwritten here.</p>
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <Section icon="🏷️" title="Product details" hint="What shoppers see first">
              <Field label="Name" required>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Name in Arabic">
                <ArabicInput english={name} value={nameAr} onChange={setNameAr} className={inputClass} compact />
              </Field>
              <Field label="Brand">
                <input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Brand in Arabic">
                <ArabicInput english={brand} value={brandAr} onChange={setBrandAr} className={inputClass} compact />
              </Field>
              <Field label="Category" required>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full">
                  {orderedCategories(categories).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent_id ? `↳ ${localizedName(c, locale)}` : localizedName(c, locale)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="SKU" hint="Optional code you use internally.">
                <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputClass} />
              </Field>
            </Section>

            <Section icon="📝" title="Description" hint="Shown on the product page">
              <Field label="Description">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={textareaClass} />
              </Field>
              <Field label="Description in Arabic">
                <ArabicInput english={description} value={descriptionAr} onChange={setDescriptionAr} className={textareaClass} multiline rows={4} />
              </Field>
            </Section>

            <Section icon="💰" title="Pack size and price" hint="The size customers buy and what it costs">
              <Field label="Size label" required hint="For example 1 L, 500 g or Pack of 6.">
                <input value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Size label in Arabic">
                <ArabicInput english={variantLabel} value={variantLabelAr} onChange={setVariantLabelAr} className={inputClass} compact />
              </Field>
              <Field label="Unit">
                <Select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full">
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount per unit" hint="How many units are in this pack.">
                <input type="number" step="0.001" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
              </Field>
              <Field label={`Price (${currency})`} required hint="What the customer pays, tax included.">
                <input type="number" step="0.01" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
              </Field>
              <Field label={`Was price (${currency})`} hint={offPct > 0 ? `Shows as ${offPct}% off.` : "Optional. Shown crossed out to show a saving."}>
                <input type="number" step="0.01" min={0} value={compareAt} onChange={(e) => setCompareAt(e.target.value)} className={inputClass} />
              </Field>
            </Section>

            <Section icon="🧾" title="Tax and ordering">
              <div className="sm:col-span-2">
                <TaxFields taxRate={taxRate} onTaxRate={setTaxRate} hsnCode={hsnCode} onHsnCode={setHsnCode} />
              </div>
              <div className="sm:col-span-2">
                <OrderLimitField value={maxOrderQty} onChange={setMaxOrderQty} />
              </div>
            </Section>
          </div>
        </div>

        {/* footer */}
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-white px-5 py-3">
          <p className={`min-w-0 flex-1 text-sm font-medium ${error ? "text-rose-700" : "text-neutral-400"}`}>{error ?? "Changes apply to the shop as soon as you save."}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={secondaryButton}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={pending} className={primaryButton}>
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
