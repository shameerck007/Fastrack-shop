"use client";

import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useLocale } from "@/components/LocaleProvider";

export default function DeliverToChip({ className = "" }: { className?: string }) {
  const { location, serviceable, openPicker, ready } = useDeliveryLocation();
  const { t } = useLocale();

  return (
    <button
      onClick={openPicker}
      className={`group flex max-w-full items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 ps-1 pe-3 text-start shadow-sm transition hover:border-blue-300 hover:bg-blue-50/60 ${className}`}
      aria-label={t("header.change_location")}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm transition group-hover:bg-blue-100">
        📍
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{t("header.deliver_to")}</span>
        {!ready ? (
          <span className="h-3.5 w-20 animate-pulse rounded bg-neutral-200" />
        ) : (
          <span className="max-w-[9rem] truncate text-sm font-semibold text-neutral-900 sm:max-w-[14rem]">
            {location?.label ?? t("header.choose_location")}
          </span>
        )}
      </span>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition group-hover:text-blue-600"
      >
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
      </svg>
      {location && serviceable === false && (
        <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
          {t("header.not_serviceable")}
        </span>
      )}
    </button>
  );
}
