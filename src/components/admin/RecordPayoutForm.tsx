"use client";

import { useState } from "react";
import { recordSettlementPayout } from "@/lib/actions/admin-settlements";
import { useLocale } from "@/components/LocaleProvider";
import { useCurrency, useMoney } from "@/components/MoneyProvider";
import Select from "@/components/ui/Select";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { Field, inputClass, primaryButton } from "@/components/ui/Form";

const METHODS = ["bank_transfer", "cheque", "cash", "other"];

/** Record a payout to a supplier. The button opens a popup. */
export default function RecordPayoutForm({ storeId, balanceDue }: { storeId: string; balanceDue: number }) {
  const money = useMoney();
  const currency = useCurrency();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  async function save(): Promise<string | void> {
    const parsed = Number(amount);
    if (!(parsed > 0)) return t("payout_form.invalid_amount");
    await recordSettlementPayout({ storeId, amount: parsed, method, reference, note });
    setAmount("");
    setReference("");
    setNote("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAmount(balanceDue > 0.005 ? balanceDue.toFixed(2) : "");
          setOpen(true);
        }}
        className={primaryButton}
      >
        {t("payout_form.record_payout")}
      </button>
      {open && (
        <FormDialog icon="💸" title={t("payout_form.record_a_payout")} subtitle={balanceDue > 0.005 ? t("payout_form.outstanding_balance", { amount: money(balanceDue) }) : undefined} saveLabel={t("payout_form.record_a_payout")} onClose={() => setOpen(false)} onSave={save}>
          <DialogSection>
            <Field label={t("payout_form.amount_sar", { currency })} required>
              <input type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required />
            </Field>
            <Field label={t("payout_form.method")}>
              <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full">
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`merchant.${m}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("payout_form.reference_optional")}>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("payout_form.reference_placeholder")} className={inputClass} />
            </Field>
            <Field label={t("payout_form.note_optional")}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("payout_form.note_placeholder")} className={inputClass} />
            </Field>
          </DialogSection>
        </FormDialog>
      )}
    </>
  );
}
