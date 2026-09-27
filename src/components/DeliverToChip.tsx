"use client";

import { useDeliveryLocation } from "@/components/delivery-location-context";

export default function DeliverToChip({ className = "" }: { className?: string }) {
  const { location, serviceable, openPicker, ready } = useDeliveryLocation();

  return (
    <button
      onClick={openPicker}
      className={`flex max-w-full items-center gap-1.5 rounded-full text-sm hover:text-blue-700 ${className}`}
      aria-label="Change delivery location"
    >
      <span aria-hidden>📍</span>
      <span className="truncate">
        <span className="text-neutral-500">Deliver to </span>
        <span className="font-semibold text-neutral-900">
          {!ready ? "…" : (location?.label ?? "Select location")}
        </span>
      </span>
      <span aria-hidden className="text-xs text-neutral-400">▾</span>
      {location && serviceable === false && (
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
          Not serviceable
        </span>
      )}
    </button>
  );
}
