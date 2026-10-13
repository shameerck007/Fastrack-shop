"use client";

import { useState } from "react";
import { errorText, unwrapAction } from "@/lib/errors";
import { exportMyProducts, findCatalogForTemplate, type CatalogPick } from "@/lib/actions/supplier-integrations";
import { buildProductWorkbook, downloadXlsx, sheetRow } from "@/lib/product-template";

const MAX_PICK = 300;

export interface CategoryOption {
  id: string;
  name: string;
  parent_id: string | null;
}

/** The two ways to start an Excel file without a blank sheet: your own products, or products picked from the FasTrack catalog. */
export default function ExcelStarters({ categories }: { categories: CategoryOption[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CatalogPick[]>([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Map<string, CatalogPick>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const topLevel = categories.filter((c) => !c.parent_id);

  async function downloadMine() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await unwrapAction(exportMyProducts)();
      if (r.rows.length === 0) {
        setMsg({ ok: false, text: r.skipped ? `Your ${r.skipped} product${r.skipped === 1 ? " has" : "s have"} no sku or barcode, so they cannot be matched on upload. Add a sku to them in Products & Stock first.` : "You have no products yet." });
      } else {
        downloadXlsx(buildProductWorkbook(r.rows.map((x) => sheetRow({ ...x }))), "my-fastrack-products.xlsx");
        const bits = [`${r.rows.length} row${r.rows.length === 1 ? "" : "s"} downloaded.`];
        if (r.skipped) bits.push(`${r.skipped} product${r.skipped === 1 ? " was" : "s were"} left out because ${r.skipped === 1 ? "it has" : "they have"} no sku or barcode.`);
        if (r.truncated) bits.push("Only the first 3000 products are included.");
        setMsg({ ok: true, text: bits.join(" ") });
      }
    } catch (e) {
      setMsg({ ok: false, text: errorText(e, "Could not export your products.") });
    }
    setBusy(false);
  }

  async function search(p: number) {
    setLoading(true);
    setError(null);
    try {
      const r = await unwrapAction(findCatalogForTemplate)(q, cat, p);
      setItems(r.items);
      setTotal(r.total);
      setPage(p);
      setSearched(true);
    } catch (e) {
      setError(errorText(e, "Search failed."));
    }
    setLoading(false);
  }

  function toggle(it: CatalogPick) {
    setPicked((m) => {
      const n = new Map(m);
      if (n.has(it.id)) n.delete(it.id);
      else if (n.size < MAX_PICK) n.set(it.id, it);
      return n;
    });
  }

  function downloadPicked() {
    const rows = [...picked.values()].flatMap((it) =>
      it.packs
        .filter((p) => p.barcode)
        .map((p) => sheetRow({ barcode: p.barcode, name: it.name, brand: it.brand, variant_label: p.label, unit: p.unit, quantity: p.quantity })),
    );
    downloadXlsx(buildProductWorkbook(rows), "fastrack-catalog-products.xlsx");
  }

  const pages = Math.max(1, Math.ceil(total / 30));
  const selectable = (it: CatalogPick) => !it.sold && it.packs.some((p) => p.barcode);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <span className="text-2xl" aria-hidden>🔄</span>
        <h3 className="mt-2 text-sm font-semibold text-neutral-900">Update what you already sell</h3>
        <p className="mt-1 flex-1 text-sm text-neutral-500">Download your products with their current prices and stock, change what you need in Excel, then upload the file below.</p>
        <button onClick={downloadMine} disabled={busy} className="mt-4 h-11 self-start rounded-full border border-neutral-300 px-5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50">
          {busy ? "Preparing…" : "Download my products (.xlsx)"}
        </button>
        {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      </div>

      <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <span className="text-2xl" aria-hidden>📚</span>
        <h3 className="mt-2 text-sm font-semibold text-neutral-900">Add products from the FasTrack catalog</h3>
        <p className="mt-1 flex-1 text-sm text-neutral-500">Search the catalog, tick the products you sell, and get a sheet already filled with their barcodes. You only add price and stock.</p>
        <button onClick={() => setOpen((v) => !v)} className="mt-4 h-11 self-start rounded-full bg-brand-700 px-5 text-sm font-bold text-white transition hover:bg-brand-800">
          {open ? "Close the catalog" : "Find catalog products"}
        </button>
      </div>

      {open && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:col-span-2 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search(1);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, brand or barcode"
              className="min-h-[2.75rem] flex-1 rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3 text-sm">
              <option value="">All categories</option>
              {topLevel.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" disabled={loading} className="h-11 rounded-full bg-brand-700 px-6 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
              {loading ? "Searching…" : "Search"}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {searched && (
            <>
              <p className="mt-3 text-xs text-neutral-500">
                {total.toLocaleString()} product{total === 1 ? "" : "s"} found{total > 30 ? `, page ${page} of ${pages}` : ""}. Products you already sell, or without a barcode, cannot be picked.
              </p>
              <ul className="mt-2 divide-y divide-neutral-100">
                {items.map((it) => {
                  const ok = selectable(it);
                  const on = picked.has(it.id);
                  return (
                    <li key={it.id}>
                      <label className={`flex items-center gap-3 py-2.5 ${ok ? "cursor-pointer" : "opacity-50"}`}>
                        <input type="checkbox" disabled={!ok || (!on && picked.size >= MAX_PICK)} checked={on} onChange={() => toggle(it)} className="h-4 w-4 shrink-0 accent-brand-700" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {it.imageUrl ? <img src={it.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-neutral-50 object-contain" /> : <span className="h-10 w-10 shrink-0 rounded-lg bg-neutral-100" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-neutral-900">{it.name}</span>
                          <span className="block truncate text-xs text-neutral-500">
                            {[it.brand, it.categoryName, it.packs.map((p) => p.label).join(", ")].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {it.sold && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">In your store</span>}
                        {!it.sold && !it.packs.some((p) => p.barcode) && <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">No barcode</span>}
                      </label>
                    </li>
                  );
                })}
                {items.length === 0 && <li className="py-6 text-center text-sm text-neutral-500">Nothing found. Try another word or a barcode.</li>}
              </ul>
              {pages > 1 && (
                <div className="mt-2 flex items-center justify-between">
                  <button onClick={() => search(page - 1)} disabled={page <= 1 || loading} className="h-9 rounded-full border border-neutral-300 px-4 text-xs font-semibold disabled:opacity-40">
                    ← Previous
                  </button>
                  <span className="text-xs text-neutral-500">
                    {page} / {pages}
                  </span>
                  <button onClick={() => search(page + 1)} disabled={page >= pages || loading} className="h-9 rounded-full border border-neutral-300 px-4 text-xs font-semibold disabled:opacity-40">
                    Next →
                  </button>
                </div>
              )}
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
            <p className="text-sm text-neutral-700">
              <b>{picked.size}</b> selected <span className="text-neutral-500">(up to {MAX_PICK})</span>
            </p>
            <div className="flex gap-2">
              {picked.size > 0 && (
                <button onClick={() => setPicked(new Map())} className="h-10 rounded-full px-4 text-xs font-semibold text-neutral-600 hover:bg-neutral-100">
                  Clear
                </button>
              )}
              <button onClick={downloadPicked} disabled={picked.size === 0} className="h-10 rounded-full bg-brand-700 px-5 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-40">
                Download sheet for {picked.size || "…"} product{picked.size === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
