"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useDefaultMaxQty } from "@/components/MoneyProvider";
import type { MasterProduct } from "@/lib/master-catalog";

const field = "w-full min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-500 hover:border-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export interface OfferRow {
  masterVariantId: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
}

/** Price and stock for each pack size of a catalog product: shared by the supplier ("Add to my store") and by FasTrack's own shop. */
export default function OfferModal({
  product,
  currency,
  title,
  submitLabel,
  note,
  extra,
  onSubmit,
  onClose,
  onDone,
}: {
  product: MasterProduct;
  currency: string;
  title: string;
  submitLabel: string;
  note?: string;
  /** Extra control shown above the pack sizes (for example the FasTrack location). */
  extra?: React.ReactNode;
  onSubmit: (offers: OfferRow[], maxOrderQty: number) => Promise<{ error?: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState(product.variants.map((v) => ({ id: v.id, label: v.label, price: "", compare: "", stock: "" })));
  const defaultMaxQty = useDefaultMaxQty();
  const [maxQty, setMaxQty] = useState(String(defaultMaxQty));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(Number(maxQty)) || !(Number(maxQty) >= 1)) {
      setError("Enter the maximum order quantity: a whole number of 1 or more.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await onSubmit(rows.map((r) => ({ masterVariantId: r.id, price: Number(r.price) || 0, compareAtPrice: Number(r.compare) || undefined, stock: Number(r.stock) || 0 })), Number(maxQty));
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          {note ?? "Set your price and stock for each pack size you sell. Leave a pack size empty to skip it. The name, photo and details come from the catalog."}
        </p>
        {extra}
        <div className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <div key={r.id} className="rounded-xl border border-neutral-200 p-3">
              <p className="mb-2 text-sm font-bold text-neutral-900">{r.label}</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-neutral-500">
                  Price ({currency})
                  <input type="number" min={0} step="0.01" value={r.price} onChange={(e) => setRows((rs) => rs.map((x, idx) => (idx === i ? { ...x, price: e.target.value } : x)))} className={`${field} mt-1`} />
                </label>
                <label className="text-xs text-neutral-500">
                  Was price
                  <input type="number" min={0} step="0.01" value={r.compare} onChange={(e) => setRows((rs) => rs.map((x, idx) => (idx === i ? { ...x, compare: e.target.value } : x)))} className={`${field} mt-1`} />
                </label>
                <label className="text-xs text-neutral-500">
                  Stock
                  <input type="number" min={0} step="any" value={r.stock} onChange={(e) => setRows((rs) => rs.map((x, idx) => (idx === i ? { ...x, stock: e.target.value } : x)))} className={`${field} mt-1`} />
                </label>
              </div>
            </div>
          ))}
        </div>
        <label className="text-xs font-medium text-neutral-500">
          Maximum order quantity <span className="text-brand-700">*</span>
          <input type="number" min={1} step={1} required value={maxQty} onChange={(e) => setMaxQty(e.target.value.replace(/[^0-9]/g, ""))} className={`${field} mt-1`} />
          <span className="mt-1 block text-[11px] text-neutral-500">The most a customer can buy of this product in one order. You can change it later.</span>
        </label>
        {error && <p className="text-sm text-brand-900">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-700">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-full bg-brand-700 px-6 py-2 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
