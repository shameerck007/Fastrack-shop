"use client";

import { usePathname } from "next/navigation";
import { useDeliveryLocation } from "@/components/delivery-location-context";

const HIDE_PREFIXES = ["/admin", "/rider", "/merchant"];

export default function DeliveryBanner() {
  const pathname = usePathname();
  const { location, serviceable, openPicker } = useDeliveryLocation();

  if (HIDE_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (!location || serviceable !== false) return null;

  return (
    <div className="border-b border-red-200 bg-red-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-red-700">
        <p>
          <span className="font-semibold">We don&apos;t deliver to {location.label} yet.</span> You can browse, but
          items can&apos;t be added to your cart here.
        </p>
        <button onClick={openPicker} className="font-medium underline">
          Change location
        </button>
      </div>
    </div>
  );
}
