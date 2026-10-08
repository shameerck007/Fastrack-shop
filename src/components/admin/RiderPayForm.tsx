"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRiderPay } from "@/lib/actions/admin-rider-pay";
import { useCurrency } from "@/components/MoneyProvider";

const field = "min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

/** How this rider is paid: per delivery (gig), or a fixed monthly salary like an employee. */
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
  const router = useRouter();
  const [payType, setPayType] = useState(initialType);
  const [salary, setSalary] = useState(monthlySalary == null ? "" : String(monthlySalary));
  const [extra, setExtra] = useState(deliveriesEarnExtra);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await updateRiderPay({ riderId, payType, monthlySalary: salary === "" ? null : Number(salary), deliveriesEarnExtra: extra });
    setSaving(false);
    if (res.error) {
      setMsg({ ok: false, text: res.error });
      return;
    }
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["per_delivery", "Per delivery", "Gig rider: paid for each delivery"],
            ["salary", "Monthly salary", "Employee: fixed salary each month"],
          ] as const
        ).map(([value, title, hint]) => (
          <button
            key={value}
            type="button"
            onClick={() => setPayType(value)}
            className={`rounded-xl border p-3 text-start ${payType === value ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-neutral-300"}`}
          >
            <span className="block text-sm font-bold text-neutral-900">{title}</span>
            <span className="block text-xs text-neutral-500">{hint}</span>
          </button>
        ))}
      </div>
      {payType === "salary" && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-neutral-500">Monthly salary ({currency})</span>
            <input type="number" min={0} step={0.01} value={salary} onChange={(e) => setSalary(e.target.value)} className={field} required />
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)} className="h-4 w-4 accent-blue-700" />
            Deliveries also earn the per-delivery pay on top of the salary
          </label>
          <p className="text-xs text-neutral-400">The salary is added to the rider&apos;s balance each month when you record it on the settlement page.</p>
        </>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-blue-700" : "text-red-600"}`}>{msg.text}</p>}
      <button type="submit" disabled={saving} className="self-start rounded-full bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50">
        {saving ? "Saving…" : "Save pay type"}
      </button>
    </form>
  );
}
