"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import type { MasterProduct } from "@/lib/master-catalog";

const field = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

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
  onSubmit: (offers: OfferRow[]) => Promise<{ error?: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState(product.variants.map((v) => ({ id: v.id, label: v.label, price: "", compare: "", stock: "" })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await onSubmit(rows.map((r) => ({ masterVariantId: r.id, price: Number(r.price) || 0, compareAtPrice: Number(r.compare) || undefined, stock: Number(r.stock) || 0 })));
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
        {error && <p className="text-sm text-blue-900">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-700">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-full bg-blue-700 px-6 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
