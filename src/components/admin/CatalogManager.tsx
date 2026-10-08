"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MasterProductForm from "@/components/admin/MasterProductForm";
import { approveMasterProduct, rejectMasterProduct, buildCatalogFromProducts, addMasterToFastrack } from "@/lib/actions/admin-catalog";
import OfferModal from "@/components/OfferModal";
import { useCurrency } from "@/components/MoneyProvider";
import type { MasterProduct } from "@/lib/master-catalog";

interface Cat {
  id: string;
  name: string;
  parent_id: string | null;
}

export default function CatalogManager({
  products,
  categories,
  fastrackLocations = [],
  fastrackIds = [],
}: {
  products: MasterProduct[];
  categories: Cat[];
  /** FasTrack's own locations (warehouses no supplier owns). */
  fastrackLocations?: { id: string; name: string }[];
  /** Catalog products FasTrack already sells. */
  fastrackIds?: string[];
}) {
  const router = useRouter();
  const currency = useCurrency();
  const [selling, setSelling] = useState<MasterProduct | null>(null);
  const [location, setLocation] = useState(fastrackLocations[0]?.id ?? "");
  const soldByFastrack = new Set(fastrackIds);
  const [tab, setTab] = useState<"catalog" | "requests">("catalog");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<MasterProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const approved = products.filter((p) => p.status === "approved");
  const pending = products.filter((p) => p.status === "pending");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (tab === "catalog" ? approved : pending).filter(
      (p) => !needle || [p.name, p.nameAr, p.brand, p.barcode, p.categoryName].some((f) => f?.toLowerCase().includes(needle))
    );
  }, [tab, q, approved, pending]);

  async function approve(id: string) {
    setBusy(id);
    const res = await approveMasterProduct(id);
    setBusy(null);
    if (res.error) setMessage(res.error);
    router.refresh();
  }

  async function reject(id: string) {
    const reason = window.prompt("Why is this request declined? The supplier will see this.");
    if (!reason) return;
    setBusy(id);
    const res = await rejectMasterProduct(id, reason);
    setBusy(null);
    if (res.error) setMessage(res.error);
    router.refresh();
  }

  async function build() {
    if (!window.confirm("Create catalog products from the products already on sale? Matching products (same barcode, or same name and brand) are grouped and linked. You can run this again later.")) return;
    setBusy("build");
    setMessage(null);
    const res = await buildCatalogFromProducts();
    setBusy(null);
    setMessage(res.error ?? `Done: ${res.created} catalog products created, ${res.linked} supplier and FasTrack products linked.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-neutral-100 p-0.5 text-sm font-bold">
          {(
            [
              ["catalog", `Catalog (${approved.length})`],
              ["requests", `Requests (${pending.length})`],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full px-4 py-1.5 ${tab === key ? "bg-blue-700 text-white shadow" : "text-neutral-500"}`}>
              {label}
              {key === "requests" && pending.length > 0 && tab !== "requests" && <span className="ms-1 inline-block h-2 w-2 rounded-full bg-blue-500" />}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">🔍</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, brand, barcode…" className="w-full rounded-full border border-neutral-300 bg-white py-2 pe-4 ps-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="ms-auto flex gap-2">
          <button type="button" onClick={build} disabled={busy === "build"} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-blue-50 disabled:opacity-50">
            {busy === "build" ? "Building…" : "Build from existing products"}
          </button>
          <button type="button" onClick={() => setCreating(true)} className="rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white hover:bg-blue-800">
            + Add product
          </button>
        </div>
      </div>

      {message && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">{message}</p>}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <span className="text-4xl">{tab === "catalog" ? "📚" : "📭"}</span>
          <p className="font-semibold text-neutral-700">{tab === "catalog" ? "No catalog products yet" : "No pending requests"}</p>
          <p className="text-sm text-neutral-500">
            {tab === "catalog" ? "Use Build from existing products to start from what is already on sale, or add one by hand." : "Suppliers' requests for new products appear here."}
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl">📦</span>
                )}
              </span>
              <div className="min-w-[10rem] flex-1">
                <p className="font-bold text-neutral-900">{p.name}</p>
                <p className="text-xs text-neutral-500">
                  {[p.brand, p.categoryName, p.variants.map((v) => v.label).join(" · ")].filter(Boolean).join(" · ")}
                </p>
                {p.barcode && <p className="text-[11px] text-neutral-400">Barcode {p.barcode}</p>}
                {tab === "requests" && (
                  <p className="mt-0.5 text-xs font-semibold text-blue-800">Requested by {p.requestedByName ?? "a supplier"}</p>
                )}
              </div>
              {tab === "catalog" ? (
                <>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {p.offers} {p.offers === 1 ? "supplier" : "suppliers"}
                  </span>
                  {soldByFastrack.has(p.id) ? (
                    <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-500">✓ Sold by FasTrack</span>
                  ) : (
                    <button type="button" onClick={() => setSelling(p)} className="rounded-full bg-blue-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-800">
                      Sell in FasTrack shop
                    </button>
                  )}
                  <button type="button" onClick={() => setEditing(p)} className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50">
                    Edit
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(p)} className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-bold text-neutral-700">
                    Review / edit
                  </button>
                  <button type="button" disabled={busy === p.id} onClick={() => reject(p.id)} className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-bold text-neutral-700 disabled:opacity-50">
                    Decline
                  </button>
                  <button type="button" disabled={busy === p.id} onClick={() => approve(p.id)} className="rounded-full bg-blue-700 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                    Approve
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {selling && (
        <OfferModal
          product={selling}
          currency={currency}
          title={`Sell ${selling.name} in the FasTrack shop`}
          submitLabel="Add to FasTrack shop"
          note="Set FasTrack's price and the opening stock for each pack size. The stock goes to the location below; other FasTrack locations start at 0."
          extra={
            fastrackLocations.length > 1 ? (
              <label className="text-xs font-medium text-neutral-500">
                Stock location
                <select value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
                  {fastrackLocations.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null
          }
          onSubmit={(offers) => addMasterToFastrack(selling.id, location, offers)}
          onClose={() => setSelling(null)}
          onDone={() => {
            setSelling(null);
            router.refresh();
          }}
        />
      )}
      {creating && <MasterProductForm key="new" open onClose={() => setCreating(false)} categories={categories} />}
      {editing && <MasterProductForm key={editing.id} open onClose={() => setEditing(null)} categories={categories} existing={editing} />}
    </div>
  );
}
