"use client";

import { useState } from "react";
import { recordSettlementPayout } from "@/lib/actions/admin-settlements";
import { formatSAR } from "@/lib/utils";

const METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export default function RecordPayoutForm({ storeId, balanceDue }: { storeId: string; balanceDue: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!(parsed > 0)) {
      setError("Enter a payout amount greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordSettlementPayout({ storeId, amount: parsed, method, reference, note });
      setOpen(false);
      setAmount("");
      setReference("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record the payout.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setAmount(balanceDue > 0.005 ? balanceDue.toFixed(2) : "");
          setOpen(true);
        }}
        className="rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
      >
        ＋ Record payout
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">Record a payout</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">Amount (SAR)</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">Method</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">Reference (optional)</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Transfer ID, cheque no…"
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note"
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>

      {balanceDue > 0.005 && (
        <p className="text-xs text-neutral-400">Outstanding balance: {formatSAR(balanceDue)}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-full bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {saving ? "Recording…" : "Record payout"}
      </button>
    </form>
  );
}
