"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateWarehouseStandardDelivery } from "@/lib/actions/admin-zones";

const field = "rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

/** Express vs Standard for one warehouse. The map radius below controls Express only;
 * these settings control the broader Standard service (and so whether products stay visible). */
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
  const [enabled, setEnabled] = useState(initialEnabled);
  const [limit, setLimit] = useState(initialRadiusKm != null);
  const [radius, setRadius] = useState(initialRadiusKm != null ? String(initialRadiusKm) : "");
  const [days, setDays] = useState(String(initialDays));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await updateWarehouseStandardDelivery(warehouseId, {
      enabled,
      radiusKm: enabled && limit && radius.trim() ? Number(radius) : null,
      days: Number(days),
    });
    setSaving(false);
    if (res.error) {
      setMessage({ ok: false, text: res.error });
      return;
    }
    setMessage({ ok: true, text: "Standard delivery settings saved." });
    router.refresh();
  }

  return (
    <section className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
      <h3 className="text-sm font-extrabold text-neutral-900">Express vs Standard delivery</h3>
      <p className="mt-1 text-xs text-neutral-600">
        The radius you draw on the map controls <b>Express</b> delivery only
        {expressRadiusKm != null ? ` (currently ${expressRadiusKm} km)` : " (none set — Express is not limited by distance)"}. Customers outside it
        still see this seller&apos;s products and can order with <b>Standard</b> delivery, as long as Standard is on below.
      </p>

      <label className="mt-3 flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
        Standard delivery is available
      </label>

      {enabled && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
              <input type="checkbox" checked={limit} onChange={(e) => setLimit(e.target.checked)} className="h-4 w-4" />
              Limit Standard to a distance
            </label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              disabled={!limit}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              placeholder="No limit"
              className={`${field} mt-1.5 w-full disabled:bg-neutral-100`}
            />
            <p className="mt-1 text-[11px] text-neutral-400">km from the shop. Leave the box unticked for no limit.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600">Estimated delivery time (days)</label>
            <input type="number" min={0} max={30} step={1} value={days} onChange={(e) => setDays(e.target.value)} className={`${field} mt-1.5 w-full`} />
            <p className="mt-1 text-[11px] text-neutral-400">Shown to customers as &ldquo;Delivery by &lt;date&gt;&rdquo;.</p>
          </div>
        </div>
      )}

      {!enabled && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          With Standard off, this seller&apos;s products are only visible and orderable inside the Express radius.
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save delivery settings"}
        </button>
        {message && <span className={`text-xs font-medium ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</span>}
      </div>
    </section>
  );
}
