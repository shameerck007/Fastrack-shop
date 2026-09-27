"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import ZonesOverviewMap, { type OverviewZone, type OverviewPoint } from "@/components/admin/ZonesOverviewMap";

export default function ZonesCoverageButton({
  zones,
  customerPoints,
}: {
  zones: OverviewZone[];
  customerPoints: OverviewPoint[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      >
        <span aria-hidden>🗺️</span> View coverage map
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Delivery coverage" size="xl">
        <ZonesOverviewMap zones={zones} customerPoints={customerPoints} />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600">
          {zones.map((z) => (
            <span key={z.id} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
              {z.name} · {z.radiusKm} km
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-500" /> Customer address
          </span>
          {zones.length === 0 && (
            <span className="text-neutral-400">No boundaries drawn yet — set one from the list.</span>
          )}
        </div>
      </Modal>
    </>
  );
}
