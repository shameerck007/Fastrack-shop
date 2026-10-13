"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { updateStorefrontSettings } from "@/lib/actions/admin-storefront";
import { unwrapAction } from "@/lib/errors";

type Mode = "default" | "show" | "hide";

const label = (m: Mode, marketDefault: boolean) => (m === "show" ? "Shown" : m === "hide" ? "Hidden" : `Market default (${marketDefault ? "shown" : "hidden"})`);

/** Business settings card: whether customers see the supplier shops on the shopping pages. */
export default function StorefrontSettingsCard({ showShops, marketDefault }: { showShops: boolean | null; marketDefault: boolean }) {
  const router = useRouter();
  const initial: Mode = showShops === null ? "default" : showShops ? "show" : "hide";
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Mode>(initial);
  const [mode, setMode] = useState<Mode>(initial);

  async function save(): Promise<string | void> {
    await unwrapAction(updateStorefrontSettings)({ showShops: mode === "default" ? null : mode === "show" });
    setSaved(mode);
    router.refresh();
  }

  const opts: [Mode, string, string][] = [
    ["show", "Show shops", "A Shops row on the home page, shop pages, and the shop name on products."],
    ["hide", "Hide shops", "Customers browse one catalogue. The home page closes up with no Shops row, and the seller is named only on the product page."],
    ["default", `Follow the market default (${marketDefault ? "shown" : "hidden"})`, "Marketplace markets show shops, Instamart-style markets hide them."],
  ];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-sm">🏪</span>
          Storefront
        </h2>
        <button
          type="button"
          onClick={() => {
            setMode(saved);
            setOpen(true);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 text-xs font-bold text-neutral-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
        >
          <span aria-hidden>✎</span> Edit
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
        <span className="text-neutral-600">Shops on the shopping pages</span>
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-700">{label(saved, marketDefault)}</span>
      </div>
      {open && (
        <FormDialog icon="🏪" title="Storefront" subtitle="What customers see when they shop" onClose={() => setOpen(false)} onSave={save}>
          <DialogSection cols={1} title="Shops">
            <div className="grid gap-2">
              {opts.map(([id, title, hint]) => (
                <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${mode === id ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-neutral-200"}`}>
                  <input type="radio" name="shops" checked={mode === id} onChange={() => setMode(id)} className="mt-0.5 h-4 w-4 accent-brand-700" />
                  <span>
                    <span className="block font-bold text-neutral-900">{title}</span>
                    <span className="block text-xs text-neutral-500">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </DialogSection>
        </FormDialog>
      )}
    </section>
  );
}
