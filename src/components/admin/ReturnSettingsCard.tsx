"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { Field, inputClass } from "@/components/ui/Form";
import { updateReturnSettings } from "@/lib/actions/admin-return-settings";
import { unwrapAction } from "@/lib/errors";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-neutral-600">{label}</span>
      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-700">{value}</span>
    </div>
  );
}

/** Business settings card: how long customers have to return an item, and when a return is approved without waiting for an admin. */
export default function ReturnSettingsCard({ defaultWindowDays, autoApprove }: { defaultWindowDays: number; autoApprove: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState({ days: defaultWindowDays, auto: autoApprove });
  const [days, setDays] = useState(String(defaultWindowDays));
  const [auto, setAuto] = useState(autoApprove);

  async function save(): Promise<string | void> {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 0 || n > 90) return "Enter a whole number of days from 0 to 90.";
    await unwrapAction(updateReturnSettings)({ defaultWindowDays: n, autoApprove: auto });
    setSaved({ days: n, auto });
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-sm">↩️</span>
          Returns
        </h2>
        <button
          type="button"
          onClick={() => {
            setDays(String(saved.days));
            setAuto(saved.auto);
            setOpen(true);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 text-xs font-bold text-neutral-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
        >
          <span aria-hidden>✎</span> Edit
        </button>
      </div>
      <Row label="Return period (from delivery)" value={saved.days === 0 ? "No returns" : `${saved.days} days`} />
      <Row label="Damaged or wrong items with a photo" value={saved.auto ? "Approved at once" : "An admin reviews"} />
      {open && (
        <FormDialog icon="↩️" title="Returns" subtitle="Customers return individual items, within this period" onClose={() => setOpen(false)} onSave={save}>
          <DialogSection cols={1}>
            <Field label="Return period (days from delivery)" hint="0 means no returns. A category can have its own period: edit the category on the Categories page.">
              <input type="number" min={0} max={90} step={1} value={days} onChange={(e) => setDays(e.target.value)} className={`${inputClass} sm:w-40`} />
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
              <span>
                <span className="font-bold text-neutral-900">Approve damaged, wrong or incomplete items at once</span>
                <span className="block text-xs text-neutral-500">When the customer adds a photo, a rider is sent without waiting for review. Other reasons always wait for an admin.</span>
              </span>
            </label>
          </DialogSection>
        </FormDialog>
      )}
    </section>
  );
}
