"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleAvailability } from "@/lib/actions/rider";
import { useLocale } from "@/components/LocaleProvider";

export default function AvailabilityToggle({
  isAvailable,
  size = "sm",
}: {
  isAvailable: boolean;
  size?: "sm" | "lg";
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      await toggleAvailability(!isAvailable);
      router.refresh();
    });
  }

  const sizeClasses = size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-sm";

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className={`flex items-center gap-2 rounded-full font-medium transition disabled:opacity-60 ${sizeClasses} ${
        isAvailable ? "bg-blue-500 text-white" : "bg-neutral-200 text-neutral-600"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${isAvailable ? "bg-white" : "bg-neutral-400"} ${
          isAvailable ? "animate-pulse" : ""
        }`}
      />
      {isAvailable ? t("rider.online_status") : t("rider.offline_status")}
    </button>
  );
}
