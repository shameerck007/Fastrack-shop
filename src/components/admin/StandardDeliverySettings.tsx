"use client";


import { unwrapAction } from "@/lib/errors";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateWarehouseStandardDelivery } from "@/lib/actions/admin-zones";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { Field, inputClass } from "@/components/ui/Form";

/** Express vs Standard for one warehouse. The map radius controls Express only; these settings control the broader
 * Standard service (and so whether products stay visible). Shows the current settings; Change opens a popup. */
export default function StandardDeliverySettings({
  warehouseId,
  initialEnabled,
  initialRadiusKm,
  initialDays,
  expressRadiusKm,
}: {
  warehouseId: string;
  initialEnabled: boolean;
  initialRadiusKm: number | null;
  initialDays: number;
  expressRadiusKm: number | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState({ enabled: initialEnabled, radiusKm: initialRadiusKm, days: initialDays });
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [limit, setLimit] = useState(initialRadiusKm != null);
  const [radius, setRadius] = useState(initialRadiusKm != null ? String(initialRadiusKm) : "");
  const [days, setDays] = useState(String(initialDays));

  async function save(): Promise<string | void> {
    const res = await unwrapAction(updateWarehouseStandardDelivery)(warehouseId, {
      enabled,
      radiusKm: enabled && limit && radius.trim() ? Number(radius) : null,
      days: Number(days),
    });
    if (res.error) return res.error;
    setSaved({ enabled, radiusKm: enabled && limit && radius.trim() ? Number(radius) : null, days: Number(days) });
    router.refresh();
  }

  return (
    <>
      <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-neutral-900">Express vs Standard delivery</h3>
          <p className="mt-1 text-xs text-neutral-600">
            Express: {expressRadiusKm != null ? `within ${expressRadiusKm} km (set on the map)` : "not limited by distance"}. Standard:{" "}
            <b>{saved.enabled ? `on${saved.radiusKm != null ? `, within ${saved.radiusKm} km` : ", no distance limit"}, delivered in about ${saved.days} day${saved.days === 1 ? "" : "s"}` : "off"}</b>.
          </p>
          {!saved.enabled && <p className="mt-1 text-xs font-medium text-amber-700">With Standard off, this seller&apos;s products are only visible and orderable inside the Express radius.</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            setEnabled(saved.enabled);
            setLimit(saved.radiusKm != null);
            setRadius(saved.radiusKm != null ? String(saved.radiusKm) : "");
            setDays(String(saved.days));
            setOpen(true);
          }}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
        >
          <span aria-hidden>✎</span> Change
        </button>
      </section>

      {open && (
        <FormDialog icon="🚚" title="Standard delivery" subtitle="Customers outside the Express radius can still order with Standard" saveLabel="Save delivery settings" onClose={() => setOpen(false)} onSave={save}>
          <DialogSection cols={1} hint="The radius you draw on the map controls Express only. Standard is the broader service.">
            <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-brand-700" />
              Standard delivery is available
            </label>
          </DialogSection>
          {enabled && (
            <DialogSection>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-neutral-700">
                  <input type="checkbox" checked={limit} onChange={(e) => setLimit(e.target.checked)} className="h-4 w-4 accent-brand-700" />
                  Limit Standard to a distance
                </label>
                <input type="number" min={0.1} step={0.1} disabled={!limit} value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="No limit" className={inputClass} />
                <p className="mt-1 text-xs text-neutral-500">km from the shop. Leave unticked for no limit.</p>
              </div>
              <Field label="Estimated delivery time (days)" hint="Shown to customers as “Delivery by <date>”.">
                <input type="number" min={0} max={30} step={1} value={days} onChange={(e) => setDays(e.target.value)} className={inputClass} />
              </Field>
            </DialogSection>
          )}
        </FormDialog>
      )}
    </>
  );
}
