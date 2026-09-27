"use client";

import { useState } from "react";
import { updateStoreCommissionRate } from "@/lib/actions/admin-settlements";

export default function CommissionRateEditor({ storeId, rate }: { storeId: string; rate: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(rate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setError("Enter a number between 0 and 100.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateStoreCommissionRate(storeId, parsed);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the commission rate.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setValue(String(rate));
          setEditing(true);
        }}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
      >
        {rate}% commission <span aria-hidden className="text-xs">✏️</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          autoFocus
        />
        <span className="text-sm text-neutral-500">%</span>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-blue-700 px-3 py-1 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
