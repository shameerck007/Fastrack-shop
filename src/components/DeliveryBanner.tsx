"use client";

import { usePathname } from "next/navigation";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useLocale } from "@/components/LocaleProvider";

const HIDE_PREFIXES = ["/admin", "/platform", "/rider", "/merchant", "/store", "/warehouse"];

export default function DeliveryBanner() {
  const pathname = usePathname();
  const { location, serviceable, openPicker } = useDeliveryLocation();
  const { t } = useLocale();

  if (HIDE_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (!location || serviceable !== false) return null;

  return (
    <div className="border-b border-red-200 bg-red-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-red-700">
        <p>
          <span className="font-semibold">{t("common.dont_deliver_banner", { location: location.label })}</span>{" "}
          {t("common.dont_deliver_banner_hint")}
        </p>
        <button onClick={openPicker} className="font-medium underline">
          {t("common.change_location")}
        </button>
      </div>
    </div>
  );
}
