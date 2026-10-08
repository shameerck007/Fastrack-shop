"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import ImageUploader from "@/components/ImageUploader";
import { createMasterProduct, updateMasterProduct, type MasterVariantInput } from "@/lib/actions/admin-catalog";
import type { MasterProduct } from "@/lib/master-catalog";

const field = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const lab = "mb-1 block text-xs font-medium text-neutral-500";

interface Cat {
  id: string;
  name: string;
  parent_id: string | null;
}

/** Create or edit one master product: the shared details every supplier's listing uses. */
export default function MasterProductForm({
  open,
  onClose,
  categories,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  categories: Cat[];
  existing?: MasterProduct | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [nameAr, setNameAr] = useState(existing?.nameAr ?? "");
  const [brand, setBrand] = useState(existing?.brand ?? "");
  const [brandAr, setBrandAr] = useState(existing?.brandAr ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [descriptionAr, setDescriptionAr] = useState(existing?.descriptionAr ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(existing?.imageUrl ?? null);
  const [barcode, setBarcode] = useState(existing?.barcode ?? "");
  const [hsn, setHsn] = useState(existing?.hsnCode ?? "");
  const [tax, setTax] = useState(existing?.taxRate == null ? "" : String(existing.taxRate));
  const [variants, setVariants] = useState<MasterVariantInput[]>(
    existing?.variants.length
      ? existing.variants.map((v) => ({ label: v.label, labelAr: v.labelAr ?? "", unit: v.unit, quantity: v.quantity, barcode: v.barcode ?? "", isDefault: v.isDefault }))
      : [{ label: "", unit: "unit", quantity: 1, isDefault: true }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setVariant(i: number, patch: Partial<MasterVariantInput>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name,
      nameAr,
      brand,
      brandAr,
      description,
      descriptionAr,
      categoryId: categoryId || null,
      imageUrl,
      barcode,
      hsnCode: hsn,
      taxRate: tax.trim() === "" ? null : Number(tax),
      variants,
    };
    const res = existing ? await updateMasterProduct(existing.id, payload) : await createMasterProduct(payload);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    router.refresh();
  }

  const top = categories.filter((c) => !c.parent_id);
  return (
    <Modal open={open} onClose={onClose} title={existing ? "Edit catalog product" : "Add a catalog product"} size="xl">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {existing && existing.offers > 0 && (
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900">
            {existing.offers} {existing.offers === 1 ? "supplier sells" : "suppliers sell"} this product. Saving updates their listings too (name, brand, photo, category, tax). Their prices and stock stay theirs.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
          <ImageUploader value={imageUrl} onChange={setImageUrl} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={lab}>Name *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </div>
            <div>
              <label className={lab}>Name in Arabic</label>
              <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" className={field} />
            </div>
            <div>
              <label className={lab}>Brand</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className={field} />
            </div>
            <div>
              <label className={lab}>Brand in Arabic</label>
              <input value={brandAr} onChange={(e) => setBrandAr(e.target.value)} dir="rtl" className={field} />
            </div>
            <div>
              <label className={lab}>Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${field} bg-white`}>
                <option value="">None</option>
                {top.map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    <option value={c.id}>{c.name}</option>
                    {categories
                      .filter((x) => x.parent_id === c.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {c.name} › {x.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className={lab}>Barcode (EAN / GTIN)</label>
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className={field} />
            </div>
            <div>
              <label className={lab}>Tax code (HSN, India)</label>
              <input value={hsn} onChange={(e) => setHsn(e.target.value)} className={field} />
            </div>
            <div>
              <label className={lab}>Tax percent (empty = the market default)</label>
              <input type="number" min={0} max={100} step={0.01} value={tax} onChange={(e) => setTax(e.target.value)} className={field} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lab}>Description</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
          </div>
          <div>
            <label className={lab}>Description in Arabic</label>
            <textarea rows={3} value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} dir="rtl" className={field} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-neutral-800">Pack sizes</p>
          <div className="flex flex-col gap-2">
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 p-2.5 sm:grid-cols-[1.4fr_1fr_80px_90px_1fr_auto]">
                <input placeholder="Label, e.g. 1 L" value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} className={field} />
                <input placeholder="Arabic label" dir="rtl" value={v.labelAr ?? ""} onChange={(e) => setVariant(i, { labelAr: e.target.value })} className={field} />
                <input type="number" min={0} step="any" placeholder="Qty" value={v.quantity ?? 1} onChange={(e) => setVariant(i, { quantity: Number(e.target.value) })} className={field} />
                <input placeholder="Unit" value={v.unit ?? ""} onChange={(e) => setVariant(i, { unit: e.target.value })} className={field} />
                <input placeholder="Barcode" value={v.barcode ?? ""} onChange={(e) => setVariant(i, { barcode: e.target.value })} className={field} />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-neutral-600">
                    <input type="radio" name="default-variant" checked={!!v.isDefault} onChange={() => setVariants((vs) => vs.map((x, idx) => ({ ...x, isDefault: idx === i })))} /> Default
                  </label>
                  {variants.length > 1 && !existing && (
                    <button type="button" onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))} className="text-xs text-neutral-500 hover:text-neutral-900">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setVariants((vs) => [...vs, { label: "", unit: "unit", quantity: 1 }])} className="mt-2 text-sm font-semibold text-blue-700">
            + Add a pack size
          </button>
        </div>

        {error && <p className="text-sm text-blue-900">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-700">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-full bg-blue-700 px-6 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
            {saving ? "Saving…" : existing ? "Save changes" : "Add to catalog"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
