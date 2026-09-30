"use client";

import { useState } from "react";
import { updateStoreCommissionRate } from "@/lib/actions/admin-settlements";
import { useLocale } from "@/components/LocaleProvider";

export default function CommissionRateEditor({ storeId, rate }: { storeId: string; rate: number }) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(rate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setError(t("commission_editor.invalid_rate"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateStoreCommissionRate(storeId, parsed);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("commission_editor.couldnt_save"));
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
        {t("commission_editor.commission_label", { rate })} <span aria-hidden className="text-xs">✏️</span>
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
          {saving ? t("common.saving") : t("common.save")}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-neutral-500 hover:underline">
          {t("common.cancel")}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
