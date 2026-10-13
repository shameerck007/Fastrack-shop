"use client";


import { unwrapAction } from "@/lib/errors";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrency, useMoney } from "@/components/MoneyProvider";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { Field, inputClass } from "@/components/ui/Form";
import { saveDeliveryFees, type DeliveryFeesInput } from "@/lib/actions/admin-offers";

type Defaults = { express: number; standard: number; freeOver: number };

function Stat({ icon, label, value, hint, tone }: { icon: string; label: string; value: string; hint: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-lg">{icon}</span>
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      </div>
      <p className={`mt-3 text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

/** What shoppers pay for delivery, and when it is free. Shows the current fees; Edit opens a popup. */
export default function DeliveryFeesForm({ initial, defaults }: { initial: DeliveryFeesInput; defaults: Defaults }) {
  const router = useRouter();
  const money = useMoney();
  const currency = useCurrency();
  const [saved, setSaved] = useState(initial);
  const [open, setOpen] = useState(false);
  const str = (n: number | null) => (n === null ? "" : String(n));
  const [express, setExpress] = useState(str(initial.express));
  const [standard, setStandard] = useState(str(initial.standard));
  const [freeOver, setFreeOver] = useState(str(initial.freeOver));
  const [freeEnabled, setFreeEnabled] = useState(initial.freeEnabled);

  const e = saved.express ?? defaults.express;
  const s = saved.standard ?? defaults.standard;
  const f = saved.freeOver ?? defaults.freeOver;

  async function save(): Promise<string | void> {
    const body: DeliveryFeesInput = {
      express: express.trim() === "" ? null : Number(express),
      standard: standard.trim() === "" ? null : Number(standard),
      freeOver: freeOver.trim() === "" ? null : Number(freeOver),
      freeEnabled,
    };
    const res = await unwrapAction(saveDeliveryFees)(body);
    if (res.error) return res.error;
    setSaved(body);
    router.refresh();
  }

  function edit() {
    setExpress(str(saved.express));
    setStandard(str(saved.standard));
    setFreeOver(str(saved.freeOver));
    setFreeEnabled(saved.freeEnabled);
    setOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button type="button" onClick={edit} className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white transition hover:bg-brand-800">
          <span aria-hidden>✎</span> Edit delivery fees
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon="⚡" label="Express delivery" value={money(e)} hint="Fastest delivery, from nearby shops" tone="text-brand-700" />
        <Stat icon="🚚" label="Standard delivery" value={money(s)} hint="Shop delivery days and scheduled orders" tone="text-brand-700" />
        <Stat icon="🎁" label="Free delivery" value={saved.freeEnabled ? `Over ${money(f)}` : "Off"} hint={saved.freeEnabled ? "Counted on the items, before any coupon" : "The fee is always charged"} tone={saved.freeEnabled ? "text-emerald-600" : "text-neutral-500"} />
      </div>
      <p className="text-xs text-neutral-500">
        One delivery charge is taken for the whole cart, even when it is split between several shops. For a coupon or a free-delivery weekend, use <b>Offers &amp; coupons</b>.
      </p>

      {open && (
        <FormDialog icon="🛵" title="Delivery fees" subtitle="Shown in the shop, cart and checkout straight away" onClose={() => setOpen(false)} onSave={save}>
          <DialogSection title="Fees" hint="Leave a box empty to use the standard setting for this market.">
            <Field label={`Express delivery fee (${currency})`} hint="Fastest delivery, from nearby shops.">
              <input type="number" min={0} step="any" value={express} onChange={(ev) => setExpress(ev.target.value)} placeholder={String(defaults.express)} className={inputClass} />
            </Field>
            <Field label={`Standard delivery fee (${currency})`} hint="Shop delivery days, and scheduled orders.">
              <input type="number" min={0} step="any" value={standard} onChange={(ev) => setStandard(ev.target.value)} placeholder={String(defaults.standard)} className={inputClass} />
            </Field>
          </DialogSection>
          <DialogSection title="Free delivery" cols={1}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={freeEnabled} onChange={(ev) => setFreeEnabled(ev.target.checked)} className="mt-1 h-4 w-4 accent-brand-700" />
              <span>
                <span className="block text-sm font-bold text-neutral-800">Free delivery on bigger orders</span>
                <span className="block text-xs text-neutral-500">Delivery costs nothing once the items add up to the amount below. Switch off to always charge the fee.</span>
              </span>
            </label>
            <div className={freeEnabled ? "" : "pointer-events-none opacity-40"}>
              <Field label={`Free delivery on orders of (${currency})`} hint="Counted on the items, before any coupon.">
                <input type="number" min={0} step="any" value={freeOver} onChange={(ev) => setFreeOver(ev.target.value)} placeholder={String(defaults.freeOver)} className={`${inputClass} sm:w-56`} />
              </Field>
            </div>
          </DialogSection>
        </FormDialog>
      )}
    </div>
  );
}
