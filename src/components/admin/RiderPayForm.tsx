"use client";


import { unwrapAction } from "@/lib/errors";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRiderPay } from "@/lib/actions/admin-rider-pay";
import { useCurrency, useMoney } from "@/components/MoneyProvider";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { Field, inputClass } from "@/components/ui/Form";

/** How this rider is paid: per delivery (gig), or a fixed monthly salary like an employee. Shows the current choice; Change opens a popup. */
export default function RiderPayForm({
  riderId,
  payType: initialType,
  monthlySalary,
  deliveriesEarnExtra,
}: {
  riderId: string;
  payType: "per_delivery" | "salary";
  monthlySalary: number | null;
  deliveriesEarnExtra: boolean;
}) {
  const currency = useCurrency();
  const money = useMoney();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState({ payType: initialType, salary: monthlySalary, extra: deliveriesEarnExtra });
  const [payType, setPayType] = useState(initialType);
  const [salary, setSalary] = useState(monthlySalary == null ? "" : String(monthlySalary));
  const [extra, setExtra] = useState(deliveriesEarnExtra);

  async function save(): Promise<string | void> {
    if (payType === "salary" && salary === "") return "Enter the monthly salary.";
    const res = await unwrapAction(updateRiderPay)({ riderId, payType, monthlySalary: salary === "" ? null : Number(salary), deliveriesEarnExtra: extra });
    if (res.error) return res.error;
    setSaved({ payType, salary: salary === "" ? null : Number(salary), extra });
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-bold text-neutral-900">{saved.payType === "salary" ? "Monthly salary" : "Per delivery"}</p>
          <p className="text-xs text-neutral-500">
            {saved.payType === "salary" ? `${saved.salary != null ? money(saved.salary) : "No salary set"} a month${saved.extra ? ", plus pay on each delivery" : ""}` : "Paid for each delivery"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPayType(saved.payType);
            setSalary(saved.salary == null ? "" : String(saved.salary));
            setExtra(saved.extra);
            setOpen(true);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 text-xs font-bold text-neutral-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
        >
          <span aria-hidden>✎</span> Change
        </button>
      </div>
      {open && (
        <FormDialog icon="🛵" title="How this rider is paid" saveLabel="Save pay type" onClose={() => setOpen(false)} onSave={save}>
          <DialogSection cols={1}>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["per_delivery", "Per delivery", "Gig rider: paid for each delivery"],
                  ["salary", "Monthly salary", "Employee: fixed salary each month"],
                ] as const
              ).map(([value, title, hint]) => (
                <button key={value} type="button" onClick={() => setPayType(value)} className={`rounded-xl border p-3 text-start transition ${payType === value ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-neutral-200 hover:border-neutral-300"}`}>
                  <span className="block text-sm font-bold text-neutral-900">{title}</span>
                  <span className="block text-xs text-neutral-500">{hint}</span>
                </button>
              ))}
            </div>
          </DialogSection>
          {payType === "salary" && (
            <DialogSection cols={1}>
              <Field label={`Monthly salary (${currency})`} required hint="Added to the rider's balance each month when you record it on the settlement page.">
                <input type="number" min={0} step={0.01} value={salary} onChange={(e) => setSalary(e.target.value)} className={`${inputClass} sm:w-56`} required />
              </Field>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)} className="h-4 w-4 accent-blue-700" />
                Deliveries also earn the per-delivery pay on top of the salary
              </label>
            </DialogSection>
          )}
        </FormDialog>
      )}
    </>
  );
}
