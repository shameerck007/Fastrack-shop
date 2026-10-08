"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordRiderSettlementEntry } from "@/lib/actions/admin-rider-settlements";
import { useCurrency, useMoney } from "@/components/MoneyProvider";
import Select from "@/components/ui/Select";


const field = "min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

/** Records either a payout to the rider or cash the rider handed in. The default
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
  const [kind, setKind] = useState<"payout" | "cash_deposit" | "salary" | "bonus" | "advance" | "deduction">("payout");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(payoutMethod === "bank" ? "bank_transfer" : "cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    const owesUs = balance < -0.005;
    setKind(owesUs ? "cash_deposit" : "payout");
    setMethod(owesUs || payoutMethod === "cash" ? "cash" : "bank_transfer");
    setAmount(Math.abs(balance) > 0.005 ? Math.abs(balance).toFixed(2) : "");
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!(parsed > 0)) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await recordRiderSettlementEntry({ riderId, kind, amount: parsed, method, reference, note });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setReference("");
    setNote("");
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={openForm} className="rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
        Record payment
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">Record a payment</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(
          [
            ["payout", "We paid the rider"],
            ["cash_deposit", "Rider handed in cash"],
            ["salary", "Add monthly salary"],
            ["advance", "Advance paid to rider"],
            ["deduction", "Deduction / fine"],
            ["bonus", "Add a bonus"],
          ] as const
        ).map(([value, label]) => (
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
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              kind === value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-300 text-neutral-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">Amount ({currency})</span>
          <input type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} className={field} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">Method</span>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} className={`${field} bg-white`}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">Reference (optional)</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transfer / receipt no." className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-neutral-500">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={field} />
        </label>
      </div>
      <p className="text-xs text-neutral-400">
        {kind === "salary" || kind === "bonus"
          ? "Added to what FasTrack owes the rider."
          : kind === "advance"
            ? "Money already given to the rider: it reduces the balance."
            : kind === "deduction"
              ? "A fine or deduction: it reduces the balance, no money is paid."
              : ""}{" "}
        {balance > 0.005
          ? `FasTrack owes this rider ${money(balance)}.`
          : balance < -0.005
            ? `This rider owes FasTrack ${money(-balance)} in collected cash.`
            : "Nothing outstanding."}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="self-start rounded-full bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50">
        {saving ? "Saving…" : "Record"}
      </button>
    </form>
  );
}
