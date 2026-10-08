"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { cancelStockTransfer, createStockTransfer, receiveStockTransfer, sendStockTransfer } from "@/lib/actions/transfers";
import type { Location, LowStockRow, StockOption, Transfer } from "@/lib/transfers";
import Select from "@/components/ui/Select";

const field = "w-full min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const STATUS: Record<Transfer["status"], { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-neutral-100 text-neutral-600" },
  in_transit: { label: "On its way", tone: "bg-sky-100 text-sky-800" },
  received: { label: "Received", tone: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelled", tone: "bg-neutral-100 text-neutral-500" },
};

/**
 * Stock transfers between FasTrack locations. Admin mode (no myLocationId) can use any location; staff mode is fixed to the
 * staff member's own location (they send from it and receive at it).
 */
export default function TransferManager({
  locations,
  transfers,
  stock,
  low,
  myLocationId,
}: {
  locations: Location[];
  transfers: Transfer[];
  stock: StockOption[];
  low: LowStockRow[];
  myLocationId?: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState<{ fromId?: string; toId?: string; variantId?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "done">("open");
  const name = (id: string) => locations.find((l) => l.id === id)?.name ?? "Location";

  const shown = transfers.filter((t) => (tab === "open" ? t.status === "draft" || t.status === "in_transit" : t.status === "received" || t.status === "cancelled"));
  const canSend = (t: Transfer) => !myLocationId || t.fromId === myLocationId;
  const canReceive = (t: Transfer) => !myLocationId || t.toId === myLocationId;

  async function act(id: string, fn: () => Promise<{ error?: string }>) {
    setBusy(id);
    setMessage(null);
    const res = await fn();
    setBusy(null);
    if (res.error) setMessage(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {message && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">{message}</p>}

      {low.length > 0 && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <h2 className="text-sm font-extrabold text-sky-950">Running low ({low.length})</h2>
          <p className="mb-2 text-xs text-sky-900/70">Below their minimum stock. Move stock from another location, or receive a delivery.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {low.slice(0, 10).map((r) => (
              <li key={`${r.warehouseId}-${r.variantId}`} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-neutral-900">{r.name}</span>
                  <span className="block text-xs text-neutral-500">
                    {r.warehouseName} · {r.label} · {r.stock} left (min {r.minStock})
                  </span>
                </span>
                {!myLocationId && locations.length > 1 && (
                  <button type="button" onClick={() => setCreating({ toId: r.warehouseId, variantId: r.variantId })} className="shrink-0 rounded-full bg-blue-700 px-3 py-1.5 text-xs font-bold text-white">
                    Transfer in
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-neutral-100 p-0.5 text-sm font-bold">
          {(
            [
              ["open", "Open"],
              ["done", "History"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 ${tab === k ? "bg-blue-700 text-white shadow" : "text-neutral-500"}`}>
              {l}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setCreating({})} className="ms-auto rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white hover:bg-blue-800">
          + New transfer
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <span className="text-4xl">🔁</span>
          <p className="font-semibold text-neutral-700">{tab === "open" ? "No open transfers" : "No transfers yet"}</p>
          <p className="text-sm text-neutral-500">Move stock from one FasTrack location to another. The stock leaves when you send it and arrives when it is received.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((t) => (
            <li key={t.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold text-neutral-900">
                    {t.number} <span className={`ms-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS[t.status].tone}`}>{STATUS[t.status].label}</span>
                  </p>
                  <p className="text-sm text-neutral-600">
                    {t.fromName} → <b>{t.toName}</b>
                  </p>
                  {t.note && <p className="text-xs text-neutral-400">{t.note}</p>}
                </div>
                <p className="text-xs text-neutral-400">{new Date(t.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
              </div>
              <ul className="mt-2 divide-y divide-neutral-100 text-sm">
                {t.items.map((i) => (
                  <li key={i.id} className="flex justify-between py-1.5">
                    <span className="min-w-0 truncate text-neutral-800">
                      {i.name} <span className="text-neutral-400">· {i.label}</span>
                    </span>
                    <span className="shrink-0 font-semibold">
                      {i.quantity}
                      {i.receivedQuantity != null && i.receivedQuantity !== i.quantity && <span className="ms-1 text-xs text-blue-800">(received {i.receivedQuantity})</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {(t.status === "draft" || t.status === "in_transit") && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.status === "draft" && canSend(t) && (
                    <button type="button" disabled={busy === t.id} onClick={() => act(t.id, () => sendStockTransfer(t.id))} className="rounded-full bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                      Send now (stock leaves {t.fromName})
                    </button>
                  )}
                  {t.status === "in_transit" && canReceive(t) && (
                    <button type="button" disabled={busy === t.id} onClick={() => act(t.id, () => receiveStockTransfer(t.id))} className="rounded-full bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                      Receive all at {t.toName}
                    </button>
                  )}
                  {canSend(t) && (
                    <button type="button" disabled={busy === t.id} onClick={() => act(t.id, () => cancelStockTransfer(t.id))} className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 disabled:opacity-50">
                      Cancel{t.status === "in_transit" ? " (stock returns)" : ""}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <NewTransfer
          locations={locations}
          stock={stock}
          myLocationId={myLocationId}
          preset={creating}
          onClose={() => setCreating(null)}
          onDone={() => {
            setCreating(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function NewTransfer({
  locations,
  stock,
  myLocationId,
  preset,
  onClose,
  onDone,
}: {
  locations: Location[];
  stock: StockOption[];
  myLocationId?: string;
  preset: { fromId?: string; toId?: string; variantId?: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [fromId, setFromId] = useState(myLocationId ?? preset.fromId ?? locations[0]?.id ?? "");
  const [toId, setToId] = useState(preset.toId ?? locations.find((l) => l.id !== (myLocationId ?? preset.fromId ?? locations[0]?.id))?.id ?? "");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return stock.filter((s) => s.warehouseId === fromId && s.stock > 0 && (!needle || s.name.toLowerCase().includes(needle) || s.label.toLowerCase().includes(needle))).slice(0, 40);
  }, [stock, fromId, q]);
  const chosen = Object.entries(lines).filter(([, v]) => Number(v) > 0);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await createStockTransfer({
      fromId,
      toId,
      items: chosen.map(([variantId, v]) => ({ variantId, quantity: Number(v) })),
      note,
      sendNow,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="New stock transfer" size="xl">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-neutral-500">
            From
            <Select value={fromId} disabled={!!myLocationId} onChange={(e) => { setFromId(e.target.value); setLines({}); }} className={`${field} mt-1`}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-medium text-neutral-500">
            To
            <Select value={toId} onChange={(e) => setToId(e.target.value)} className={`${field} mt-1`}>
              {locations.filter((l) => l.id !== fromId).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products at the sending location…" className={field} />
          <ul className="mt-2 max-h-72 divide-y divide-neutral-100 overflow-y-auto rounded-xl border border-neutral-200">
            {options.length === 0 ? (
              <li className="p-4 text-center text-sm text-neutral-500">No stock to send from this location.</li>
            ) : (
              options.map((o) => (
                <li key={o.variantId} className={`flex items-center justify-between gap-3 px-3 py-2 ${preset.variantId === o.variantId ? "bg-blue-50" : ""}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-neutral-900">{o.name}</span>
                    <span className="block text-xs text-neutral-500">
                      {o.label} · {o.stock} in stock
                    </span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={o.stock}
                    step="any"
                    placeholder="Qty"
                    value={lines[o.variantId] ?? ""}
                    onChange={(e) => setLines((l) => ({ ...l, [o.variantId]: e.target.value }))}
                    className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                </li>
              ))
            )}
          </ul>
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={field} />
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} className="h-4 w-4 accent-blue-700" />
          Send it now (the stock leaves {locations.find((l) => l.id === fromId)?.name ?? "the sending location"} immediately)
        </label>
        {error && <p className="text-sm text-blue-900">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-500">{chosen.length} {chosen.length === 1 ? "product" : "products"} selected</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-700">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={saving || chosen.length === 0 || !toId} className="rounded-full bg-blue-700 px-6 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
              {saving ? "Saving…" : sendNow ? "Create and send" : "Save as draft"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
