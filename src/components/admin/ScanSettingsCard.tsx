"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { updateScanSettings } from "@/lib/actions/admin-scan";
import { unwrapAction } from "@/lib/errors";

function Row({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-neutral-600">{label}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${on ? "bg-blue-100 text-blue-800" : "bg-neutral-100 text-neutral-500"}`}>{on ? "Required" : "Optional"}</span>
    </div>
  
  );
}

/** Business settings card: when scanning is a must instead of an option. */
export default function ScanSettingsCard({ requirePickupScan, requirePackScan }: { requirePickupScan: boolean; requirePackScan: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState({ pickup: requirePickupScan, pack: requirePackScan });
  const [pickup, setPickup] = useState(requirePickupScan);
  const [pack, setPack] = useState(requirePackScan);

  async function save(): Promise<string | void> {
    await unwrapAction(updateScanSettings)({ requirePickupScan: pickup, requirePackScan: pack });
    setSaved({ pickup, pack });
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-sm">📷</span>
          Scanning
        </h2>
        <button
          type="button"
          onClick={() => {
            setPickup(saved.pickup);
            setPack(saved.pack);
            setOpen(true);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 text-xs font-bold text-neutral-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
        >
          <span aria-hidden>✎</span> Edit
        </button>
      </div>
      <Row label="Rider scans the label or enters the pickup code" on={saved.pickup} />
      <Row label="Warehouse scans every item before an order is ready" on={saved.pack} />
      {open && (
        <FormDialog icon="📷" title="Scanning" subtitle="Scanning is always available. Choose where it must be used." onClose={() => setOpen(false)} onSave={save}>
          <DialogSection cols={1}>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" />
              <span>
                <span className="font-bold text-neutral-900">Rider must scan the label or enter the pickup code</span>
                <span className="block text-xs text-neutral-500">Stops the wrong parcel being collected. The store shows a 4-digit pickup code for each order; the rider enters it, or scans the parcel label. When this is off, riders can still do either, or just tap pick up.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={pack} onChange={(e) => setPack(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" />
              <span>
                <span className="font-bold text-neutral-900">Warehouse must scan or tick every item before an order is ready</span>
                <span className="block text-xs text-neutral-500">Catches missing, wrong and extra items. Items with no barcode are ticked by hand.</span>
              </span>
            </label>
          </DialogSection>
        </FormDialog>
      )}
    </section>
  );
}
