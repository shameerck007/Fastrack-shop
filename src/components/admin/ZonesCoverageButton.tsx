"use client";

import { useEffect, useState } from "react";
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
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") (maximized ? setMaximized(false) : setOpen(false));
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, maximized]);

  function close() {
    setOpen(false);
    setMaximized(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      >
        {t("zones_coverage.view_coverage_map")}
      </button>

      {open && (
        <div className={`fixed inset-0 z-[2000] flex items-center justify-center ${maximized ? "p-0" : "p-4"}`}>
          <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" onClick={close} />
          <div
            className={`relative flex w-full flex-col overflow-hidden bg-white shadow-2xl ${
              maximized ? "h-full max-h-none max-w-none rounded-none" : "max-h-[92vh] max-w-5xl rounded-2xl"
            }`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-5 py-3">
              <h2 className="text-base font-semibold text-neutral-900">{t("zones_coverage.delivery_coverage")}</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMaximized((m) => !m)}
                  aria-label={maximized ? "Restore size" : "Maximise"}
                  title={maximized ? "Restore size" : "Maximise"}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                >
                  {maximized ? "🗗" : "⛶"}
                </button>
                <button
                  onClick={close}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ZonesOverviewMap
                zones={zones}
                customerPoints={customerPoints}
                height={maximized ? "h-[calc(100vh-13rem)]" : "h-[55vh] md:h-[30rem]"}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
