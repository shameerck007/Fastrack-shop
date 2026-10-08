"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import ImageUploader from "@/components/ImageUploader";
import { addMasterToStore, requestMasterProduct } from "@/lib/actions/merchant-catalog";
import { useCurrency } from "@/components/MoneyProvider";
import type { MasterProduct } from "@/lib/master-catalog";

const field = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

interface Cat {
  id: string;
  name: string;
}

export default function CatalogBrowser({
  products,
  ownedIds,
  requests,
  categories,
}: {
  products: MasterProduct[];
  ownedIds: string[];
  requests: MasterProduct[];
  categories: Cat[];
}) {
  const router = useRouter();
  const currency = useCurrency();
  const owned = useMemo(() => new Set(ownedIds), [ownedIds]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [adding, setAdding] = useState<MasterProduct | null>(null);
  const [requesting, setRequesting] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter(
      (p) => (cat === "all" || p.categoryId === cat) && (!needle || [p.name, p.nameAr, p.brand, p.barcode, p.categoryName].some((f) => f?.toLowerCase().includes(needle)))
    );
  }, [products, q, cat]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">🔍</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, brand or barcode…" className="w-full rounded-full border border-neutral-300 bg-white py-2 pe-4 ps-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setRequesting(true)} className="ms-auto rounded-full border border-blue-600 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
          Can&apos;t find it? Request a product
        </button>
      </div>

      {requests.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-neutral-800">My requests</h2>
          <ul className="divide-y divide-neutral-100">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold text-neutral-900">{r.name}</span>
                  {r.rejectionReason && <span className="block text-xs text-neutral-500">{r.rejectionReason}</span>}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.status === "pending" ? "bg-sky-50 text-sky-800" : r.status === "approved" ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600"}`}>
                  {r.status === "pending" ? "In review" : r.status === "approved" ? "Approved" : "Declined"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <span className="text-4xl">🔎</span>
          <p className="font-semibold text-neutral-700">{products.length === 0 ? "The catalog is empty for now" : "Nothing matches your search"}</p>
          <p className="text-sm text-neutral-500">Request the product and FasTrack will add it after review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => {
            const mine = owned.has(p.id);
            return (
              <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="flex gap-3 p-3">
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-3xl">📦</span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold leading-tight text-neutral-900">{p.name}</p>
                    {p.brand && <p className="text-xs text-neutral-500">{p.brand}</p>}
                    <p className="mt-1 text-[11px] text-neutral-400">{p.variants.map((v) => v.label).join(" · ")}</p>
                    {p.categoryName && <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">{p.categoryName}</span>}
                  </div>
                </div>
                <div className="mt-auto border-t border-neutral-100 bg-neutral-50 px-3 py-2.5">
                  {mine ? (
                    <p className="text-center text-sm font-bold text-blue-700">✓ In your store</p>
                  ) : (
                    <button type="button" onClick={() => setAdding(p)} className="h-10 w-full rounded-full bg-blue-700 text-sm font-extrabold text-white hover:bg-blue-800">
                      Add to my store
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && <AddOfferModal product={adding} currency={currency} onClose={() => setAdding(null)} onDone={() => { setAdding(null); router.refresh(); }} />}
      {requesting && <RequestModal categories={categories} onClose={() => setRequesting(false)} onDone={() => { setRequesting(false); router.refresh(); }} />}
    </div>
  );
}

function AddOfferModal({ product, currency, onClose, onDone }: { product: MasterProduct; currency: string; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState(product.variants.map((v) => ({ id: v.id, label: v.label, price: "", compare: "", stock: "" })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await addMasterToStore(
      product.id,
      rows.map((r) => ({ masterVariantId: r.id, price: Number(r.price) || 0, compareAtPrice: Number(r.compare) || undefined, stock: Number(r.stock) || 0 }))
    );
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <Modal open onClose={onClose} title={`Add ${product.name}`} size="md">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">Set your price and stock for each pack size you sell. Leave a pack size empty to skip it. The name, photo and details come from the catalog.</p>
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
            {saving ? "Adding…" : "Add to my store"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RequestModal({ categories, onClose, onDone }: { categories: Cat[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sizes, setSizes] = useState([{ label: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await requestMasterProduct({ name, nameAr, brand, description, categoryId: categoryId || null, imageUrl, barcode, variants: sizes });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Request a new product" size="xl">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">FasTrack checks the details and adds it to the catalog. You will get a notification when it is approved, then you can add your price and stock.</p>
        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
          <ImageUploader value={imageUrl} onChange={setImageUrl} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input required placeholder="Product name *" value={name} onChange={(e) => setName(e.target.value)} className={field} />
            <input placeholder="Name in Arabic" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} className={field} />
            <input placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} className={field} />
            <input placeholder="Barcode (EAN / GTIN)" value={barcode} onChange={(e) => setBarcode(e.target.value)} className={field} />
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${field} bg-white sm:col-span-2`}>
              <option value="">Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <textarea rows={3} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
        <div>
          <p className="mb-2 text-sm font-semibold text-neutral-800">Pack sizes *</p>
          <div className="flex flex-col gap-2">
            {sizes.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input placeholder="e.g. 1 L, 500 g, pack of 6" value={s.label} onChange={(e) => setSizes((ss) => ss.map((x, idx) => (idx === i ? { label: e.target.value } : x)))} className={field} />
                {sizes.length > 1 && (
                  <button type="button" onClick={() => setSizes((ss) => ss.filter((_, idx) => idx !== i))} className="px-2 text-neutral-500">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setSizes((ss) => [...ss, { label: "" }])} className="mt-2 text-sm font-semibold text-blue-700">
            + Add a pack size
          </button>
        </div>
        {error && <p className="text-sm text-blue-900">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-700">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-full bg-blue-700 px-6 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
            {saving ? "Sending…" : "Send request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
