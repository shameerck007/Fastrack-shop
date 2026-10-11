"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCurrency, useMoney } from "@/components/MoneyProvider";
import { inputClass, primaryButton } from "@/components/ui/Form";
import { saveDeliveryFees, type DeliveryFeesInput } from "@/lib/actions/admin-offers";

type Defaults = { express: number; standard: number; freeOver: number };

function AmountField({ label, hint, value, onChange, placeholder, currency }: { label: string; hint: string; value: string; onChange: (v: string) => void; placeholder: string; currency: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold text-neutral-800">{label}</span>
      <span className="flex items-center gap-2">
        <input type="number" min={0} step="any" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputClass} w-36`} />
        <span className="text-sm font-semibold text-neutral-500">{currency}</span>
      </span>
      <span className="text-xs text-neutral-500">{hint}</span>
    </label>
  );
}

export default function DeliveryFeesForm({ initial, defaults }: { initial: DeliveryFeesInput; defaults: Defaults }) {
  const router = useRouter();
  const money = useMoney();
  const currency = useCurrency();
  const str = (n: number | null) => (n === null ? "" : String(n));
  const [express, setExpress] = useState(str(initial.express));
  const [standard, setStandard] = useState(str(initial.standard));
  const [freeOver, setFreeOver] = useState(str(initial.freeOver));
  const [freeEnabled, setFreeEnabled] = useState(initial.freeEnabled);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const num = (v: string, d: number) => (v.trim() === "" ? d : Number(v));
  const e = num(express, defaults.express);
  const s = num(standard, defaults.standard);
  const f = num(freeOver, defaults.freeOver);

  function save() {
    setMessage(null);
    const body: DeliveryFeesInput = { express: express.trim() === "" ? null : Number(express), standard: standard.trim() === "" ? null : Number(standard), freeOver: freeOver.trim() === "" ? null : Number(freeOver), freeEnabled };
    start(async () => {
      const res = await saveDeliveryFees(body);
      if (res.error) setMessage({ ok: false, text: res.error });
      else {
        setMessage({ ok: true, text: "Delivery fees saved." });
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        {message && (
          <p role="status" className={`mb-4 rounded-xl border px-3 py-2 text-sm font-medium ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {message.text}
          </p>
        )}
        <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">Fees</h2>
        <p className="mb-4 mt-0.5 text-xs text-neutral-500">One delivery charge is taken for the whole cart, even when it is split between several shops. Leave a box empty to use the standard setting for this market.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <AmountField label="Express delivery fee" hint="Fastest delivery, from nearby shops." value={express} onChange={setExpress} placeholder={String(defaults.express)} currency={currency} />
          <AmountField label="Standard delivery fee" hint="Delivery on the shop's delivery days, and scheduled orders." value={standard} onChange={setStandard} placeholder={String(defaults.standard)} currency={currency} />
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={freeEnabled} onChange={(ev) => setFreeEnabled(ev.target.checked)} className="mt-1 h-4 w-4 accent-blue-700" />
            <span>
              <span className="block text-sm font-bold text-neutral-800">Free delivery on bigger orders</span>
              <span className="block text-xs text-neutral-500">Delivery costs nothing once the items add up to the amount below. Switch off to always charge the fee.</span>
            </span>
          </label>
          <div className={`mt-3 ps-7 ${freeEnabled ? "" : "pointer-events-none opacity-40"}`}>
            <AmountField label="Free delivery on orders of" hint="Counted on the items, before any coupon." value={freeOver} onChange={setFreeOver} placeholder={String(defaults.freeOver)} currency={currency} />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={save} disabled={pending} className={primaryButton}>
            {pending ? "Saving…" : "Save delivery fees"}
          </button>
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5">
        <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">What shoppers see</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          <li className="flex justify-between gap-3">
            <span>Express</span>
            <b>{money(e)}</b>
          </li>
          <li className="flex justify-between gap-3">
            <span>Standard</span>
            <b>{money(s)}</b>
          </li>
          <li className="flex justify-between gap-3 border-t border-blue-100 pt-2">
            <span>Free delivery</span>
            <b>{freeEnabled ? `over ${money(f)}` : "off"}</b>
          </li>
        </ul>
        <p className="mt-4 text-xs text-neutral-500">For a coupon, a free-delivery weekend or a percentage off, use <b>Offers &amp; coupons</b>.</p>
      </aside>
    </div>
  );
}
