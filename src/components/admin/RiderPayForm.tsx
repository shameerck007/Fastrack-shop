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
  hideEarnings,
  dailyBonus,
  autoSalary,
  salaryDay,
}: {
  riderId: string;
  payType: "per_delivery" | "salary";
  monthlySalary: number | null;
  deliveriesEarnExtra: boolean;
  hideEarnings: boolean;
  dailyBonus: boolean | null;
  autoSalary: boolean;
  salaryDay: number;
}) {
  const currency = useCurrency();
  const money = useMoney();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState({ payType: initialType, salary: monthlySalary, extra: deliveriesEarnExtra, hide: hideEarnings, bonus: dailyBonus, auto: autoSalary, day: salaryDay });
  const [payType, setPayType] = useState(initialType);
  const [salary, setSalary] = useState(monthlySalary == null ? "" : String(monthlySalary));
  const [extra, setExtra] = useState(deliveriesEarnExtra);
  const [hide, setHide] = useState(hideEarnings);
  const [bonus, setBonus] = useState<boolean | null>(dailyBonus);
  const [auto, setAuto] = useState(autoSalary);
  const [day, setDay] = useState(String(salaryDay));

  async function save(): Promise<string | void> {
    if (payType === "salary" && salary === "") return "Enter the monthly salary.";
    const res = await unwrapAction(updateRiderPay)({ riderId, payType, monthlySalary: salary === "" ? null : Number(salary), deliveriesEarnExtra: extra, hideEarnings: hide, dailyBonus: bonus, autoSalary: auto, salaryDay: Number(day) || 1 });
    if (res.error) return res.error;
    setSaved({ payType, salary: salary === "" ? null : Number(salary), extra, hide, bonus, auto, day: Number(day) || 1 });
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-bold text-neutral-900">{saved.payType === "salary" ? "Monthly salary" : "Per delivery"}</p>
          <p className="text-xs text-neutral-500">
            {saved.payType === "salary" ? `${saved.salary != null ? money(saved.salary) : "No salary set"} a month${saved.extra ? ", plus pay on each delivery" : ""}${saved.auto ? `, added automatically on day ${saved.day}` : ""}` : "Paid for each delivery"}
          </p>
          {saved.hide && <p className="mt-0.5 text-xs font-semibold text-blue-700">Earnings are hidden from the rider&apos;s app</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            setPayType(saved.payType);
            setSalary(saved.salary == null ? "" : String(saved.salary));
            setExtra(saved.extra);
            setHide(saved.hide);
            setBonus(saved.bonus);
            setAuto(saved.auto);
            setDay(String(saved.day));
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
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4 accent-blue-700" />
                Add the salary automatically each month
              </label>
              {auto && (
                <Field label="Salary day of the month" hint="1 to 28. The salary is added once a month, on or after this day.">
                  <input type="number" min={1} max={28} step={1} value={day} onChange={(e) => setDay(e.target.value)} className={`${inputClass} sm:w-32`} />
                </Field>
              )}
            </DialogSection>
          )}
          <DialogSection cols={1} title="What the rider sees and gets">
            <label className="flex items-start gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" />
              <span>
                Hide earnings from the rider
                <span className="block text-xs text-neutral-500">The rider still sees deliveries, history, ratings and the cash to hand in, but no earned amounts, balance, salary or statement. Admins see everything.</span>
              </span>
            </label>
            <Field label="Daily-target bonus">
              <select value={bonus === null ? "auto" : bonus ? "yes" : "no"} onChange={(e) => setBonus(e.target.value === "auto" ? null : e.target.value === "yes")} className={`${inputClass} sm:w-72`}>
                <option value="auto">Follow the pay type (per-delivery riders only)</option>
                <option value="yes">Always eligible</option>
                <option value="no">Never</option>
              </select>
            </Field>
          </DialogSection>
        </FormDialog>
      )}
    </>
  );
}
