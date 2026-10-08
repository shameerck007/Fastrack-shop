"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { receiveStock } from "@/lib/actions/transfers";

// A delivery arrives: add the quantity to this stock line, with an optional batch number and expiry date.
export default function ReceiveStockButton({ inventoryId }: { inventoryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await receiveStock(inventoryId, Number(qty), batch, expiry || undefined);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setQty("");
    setBatch("");
    setExpiry("");
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full border border-blue-600 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50">
        + Receive
      </button>
    );
  }

  return (
    <form onSubmit={save} className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-blue-50 p-2 text-xs">
      <input required type="number" min={0.001} step="any" placeholder="Qty received" value={qty} onChange={(e) => setQty(e.target.value)} className="w-28 rounded-lg border border-neutral-300 px-2 py-1.5" />
      <input placeholder="Batch (optional)" value={batch} onChange={(e) => setBatch(e.target.value)} className="w-32 rounded-lg border border-neutral-300 px-2 py-1.5" />
      <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5" />
      <button type="submit" disabled={saving} className="rounded-full bg-blue-700 px-4 py-1.5 font-bold text-white disabled:opacity-50">
        {saving ? "Saving…" : "Add to stock"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-neutral-500">
        Cancel
      </button>
      {error && <span className="text-blue-900">{error}</span>}
    </form>
  );
}
