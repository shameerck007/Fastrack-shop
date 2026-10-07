"use client";

import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useLocale } from "@/components/LocaleProvider";
import { useMarket } from "@/components/MoneyProvider";
import { formatEta } from "@/lib/eta";
import { marketUi } from "@/lib/market-ui";

export default function DeliverToChip({
  className = "",
  variant = "pill",
}: {
  className?: string;
  variant?: "pill" | "plain";
}) {
  const { location, serviceable, openPicker, ready, bestEta } = useDeliveryLocation();
  const { t } = useLocale();
  // Instamart-style markets show the delivery time worked out for this location.
  const range = marketUi(useMarket().countryCode).deliveryBadges ? bestEta() : null;
  const eta = range;

  return (
    <button
      onClick={openPicker}
      className={`group flex max-w-full items-center gap-2 text-start transition ${
        variant === "pill"
          ? "rounded-full border border-neutral-200 bg-white py-1 ps-1 pe-3 shadow-sm hover:border-blue-300 hover:bg-blue-50/60"
          : "py-0.5"
      } ${className}`}
      aria-label={t("header.change_location")}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full transition ${
          variant === "pill" ? "h-7 w-7 bg-blue-50 group-hover:bg-blue-100" : "h-5 w-5"
        }`}
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-blue-700 ${variant === "pill" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"}`}>
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11Z" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.3" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        {variant === "pill" && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{t("header.deliver_to")}</span>
        )}
        {!ready ? (
          <span className="h-3.5 w-20 animate-pulse rounded bg-neutral-200" />
        ) : (
          <span className="max-w-[13rem] truncate text-sm font-bold text-neutral-900 sm:max-w-[14rem]">
            {location?.label ?? t("header.choose_location")}
          </span>
        )}
        {ready && location && serviceable !== false && eta && (
          <span className="text-[11px] font-semibold leading-tight text-blue-700">⚡ {formatEta(eta)}</span>
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
