"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/Modal";
import BarcodeScanner, { type ScanResult } from "@/components/BarcodeScanner";
import { primaryButton, secondaryButton } from "@/components/ui/Form";
import { getPackList } from "@/lib/actions/warehouse-staff";
import { errorText, unwrapAction } from "@/lib/errors";
import { normaliseCode, type PackItem } from "@/lib/scan";

/** Pack an order: scan each product's barcode (or tick items that have none) until everything is in the bag, then mark the order ready. */
export default function PackDialog({ orderId, orderNumber, onClose, onPacked }: { orderId: string; orderNumber: string; onClose: () => void; onPacked: () => Promise<string | void> }) {
  const [items, setItems] = useState<PackItem[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    unwrapAction(getPackList)(orderId)
      .then((list) => !cancelled && setItems(list))
      .catch((e) => !cancelled && setError(errorText(e, "Could not load the items.")));
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const bump = useCallback((id: string, by: number, max: number) => setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(max, (c[id] ?? 0) + by)) })), []);

  async function onScan(code: string): Promise<ScanResult> {
    if (!items) return { ok: false, message: "The items are still loading." };
    const norm = normaliseCode(code);
    const matches = items.filter((i) => i.codes.some((c) => normaliseCode(c) === norm));
    if (matches.length === 0) return { ok: false, message: "That code is not on this order. Put it back." };
    const open = matches.find((i) => (counts[i.id] ?? 0) < i.quantity);
    if (!open) return { ok: false, message: `${matches[0].name}: you already have all ${matches[0].quantity}. This one is extra.` };
    bump(open.id, 1, open.quantity);
    const left = open.quantity - (counts[open.id] ?? 0) - 1;
    return { ok: true, message: `${open.name}${left > 0 ? `: ${left} more to scan` : ": complete"}` };
  }

  const total = items?.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const done = items?.reduce((n, i) => n + Math.min(counts[i.id] ?? 0, i.quantity), 0) ?? 0;
  const complete = !!items && total > 0 && done >= total;

  async function finish() {
    setSaving(true);
    setError(null);
    const msg = await onPacked();
    setSaving(false);
    if (msg) setError(msg);
    else onClose();
  }

  return (
    <>
      <Modal open onClose={onClose} title={`Pack order #${orderNumber}`}>
        <div className="flex flex-col gap-3">
          <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-neutral-500">
            {done} of {total} items packed
          </p>
          {!items && !error && <p className="py-4 text-center text-sm text-neutral-500">Loading…</p>}
          {items && (
            <ul className="divide-y divide-neutral-100">
              {items.map((i) => {
                const n = Math.min(counts[i.id] ?? 0, i.quantity);
                const ok = n >= i.quantity;
                return (
                  <li key={i.id} className="flex items-center gap-3 py-2.5">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${ok ? "bg-emerald-500 text-white" : "bg-neutral-100 text-neutral-500"}`}>{ok ? "✓" : n}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">{i.name}</p>
                      <p className="text-xs text-neutral-500">
                        {n} of {i.quantity}
                        {i.codes.length === 0 ? " · no barcode, tick by hand" : ""}
                      </p>
                    </div>
                    {i.codes.length === 0 && (
                      <div className="flex items-center rounded-full border border-neutral-300">
                        <button type="button" className="px-3 py-1 disabled:opacity-40" disabled={n <= 0} onClick={() => bump(i.id, -1, i.quantity)}>
                          −
                        </button>
                        <button type="button" className="px-3 py-1 disabled:opacity-40" disabled={n >= i.quantity} onClick={() => bump(i.id, 1, i.quantity)}>
                          +
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setScanning(true)} disabled={!items} className={secondaryButton}>
              📷 Scan items
            </button>
            <button type="button" onClick={finish} disabled={!complete || saving} className={primaryButton}>
              {saving ? "Saving…" : "All packed: mark ready"}
            </button>
          </div>
        </div>
      </Modal>
      {scanning && <BarcodeScanner title="Scan each item" hint="Scan the barcode on every product as you put it in the bag." onScan={onScan} onClose={() => setScanning(false)} />}
    </>
  );
}
