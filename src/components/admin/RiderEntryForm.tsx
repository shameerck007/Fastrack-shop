"use client";


import { unwrapAction } from "@/lib/errors";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordRiderSettlementEntry } from "@/lib/actions/admin-rider-settlements";
import { useCurrency, useMoney } from "@/components/MoneyProvider";
import Select from "@/components/ui/Select";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { Field, inputClass, primaryButton } from "@/components/ui/Form";

type Kind = "payout" | "cash_deposit" | "salary" | "bonus" | "advance" | "deduction";

const KINDS: [Kind, string][] = [
  ["payout", "We paid the rider"],
  ["cash_deposit", "Rider handed in cash"],
  ["salary", "Add monthly salary"],
  ["advance", "Advance paid to rider"],
  ["deduction", "Deduction / fine"],
  ["bonus", "Add a bonus"],
];

/** Records either a payout to the rider or cash the rider handed in, in a popup. The default
 * follows the balance: FasTrack owes them -> payout; they owe FasTrack -> cash deposit. */
export default function RiderEntryForm({
  riderId,
  balance,
  payoutMethod,
  monthlySalary = null,
}: {
  riderId: string;
  balance: number;
  payoutMethod: "bank" | "cash";
  monthlySalary?: number | null;
}) {
  const money = useMoney();
  const currency = useCurrency();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("payout");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(payoutMethod === "bank" ? "bank_transfer" : "cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  function openForm() {
    const owesUs = balance < -0.005;
    setKind(owesUs ? "cash_deposit" : "payout");
    setMethod(owesUs || payoutMethod === "cash" ? "cash" : "bank_transfer");
    setAmount(Math.abs(balance) > 0.005 ? Math.abs(balance).toFixed(2) : "");
    setOpen(true);
  }

  async function save(): Promise<string | void> {
    const parsed = Number(amount);
    if (!(parsed > 0)) return "Enter an amount greater than zero.";
    const res = await unwrapAction(recordRiderSettlementEntry)({ riderId, kind, amount: parsed, method, reference, note });
    if (res.error) return res.error;
    setReference("");
    setNote("");
    router.refresh();
  }

  const balanceText =
    balance > 0.005 ? `FasTrack owes this rider ${money(balance)}.` : balance < -0.005 ? `This rider owes FasTrack ${money(-balance)} in collected cash.` : "Nothing outstanding.";
  const kindHint =
    kind === "salary" || kind === "bonus"
      ? "Added to what FasTrack owes the rider."
      : kind === "advance"
        ? "Money already given to the rider: it reduces the balance."
        : kind === "deduction"
          ? "A fine or deduction: it reduces the balance, no money is paid."
          : "";

  return (
    <>
      <button type="button" onClick={openForm} className={primaryButton}>
        Record payment
      </button>
      {open && (
        <FormDialog icon="💵" title="Record a payment" subtitle={balanceText} saveLabel="Record" onClose={() => setOpen(false)} onSave={save}>
          <DialogSection title="What happened" hint={kindHint || undefined} cols={1}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {KINDS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setKind(value);
                    if (value === "salary") {
                      if (monthlySalary) setAmount(monthlySalary.toFixed(2));
                      setNote((n) => n || `Salary: ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`);
                    }
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${kind === value ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </DialogSection>
          <DialogSection>
            <Field label={`Amount (${currency})`} required>
              <input type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required />
            </Field>
            <Field label="Method">
              <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Reference (optional)">
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transfer / receipt no." className={inputClass} />
            </Field>
            <Field label="Note (optional)">
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </Field>
          </DialogSection>
        </FormDialog>
      )}
    </>
  );
}
