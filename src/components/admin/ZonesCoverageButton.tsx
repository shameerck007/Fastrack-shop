"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import ZonesOverviewMap, { type OverviewZone, type OverviewPoint } from "@/components/admin/ZonesOverviewMap";
import { useLocale } from "@/components/LocaleProvider";

export default function ZonesCoverageButton({
  zones,
  customerPoints,
}: {
  zones: OverviewZone[];
  customerPoints: OverviewPoint[];
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      >
        {t("zones_coverage.view_coverage_map")}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("zones_coverage.delivery_coverage")} size="xl">
        <ZonesOverviewMap zones={zones} customerPoints={customerPoints} />
      </Modal>
    </>
  );
}
