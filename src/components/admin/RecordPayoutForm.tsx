"use client";

import { useState } from "react";
import { recordSettlementPayout } from "@/lib/actions/admin-settlements";

import { useLocale } from "@/components/LocaleProvider";
import { useCurrency, useMoney } from "@/components/MoneyProvider";

const METHODS = ["bank_transfer", "cheque", "cash", "other"];

export default function RecordPayoutForm({ storeId, balanceDue }: { storeId: string; balanceDue: number }) {
  const money = useMoney();
  const currency = useCurrency();
  const { t } = useLocale();
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
      setError(t("payout_form.invalid_amount"));
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
      setError(err instanceof Error ? err.message : t("payout_form.couldnt_record"));
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
        {t("payout_form.record_payout")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">{t("payout_form.record_a_payout")}</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          {t("common.cancel")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">{t("payout_form.amount_sar", { currency })}</span>
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
          <span className="text-xs font-medium text-neutral-500">{t("payout_form.method")}</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`merchant.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">{t("payout_form.reference_optional")}</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t("payout_form.reference_placeholder")}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">{t("payout_form.note_optional")}</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("payout_form.note_placeholder")}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>

      {balanceDue > 0.005 && (
        <p className="text-xs text-neutral-400">{t("payout_form.outstanding_balance", { amount: money(balanceDue) })}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-full bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {saving ? t("payout_form.recording") : t("payout_form.record_a_payout")}
      </button>
    </form>
  );
}
