"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleAvailability } from "@/lib/actions/rider";

export default function AvailabilityToggle({ isAvailable }: { isAvailable: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      await toggleAvailability(!isAvailable);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
        isAvailable ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-600"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${isAvailable ? "bg-white" : "bg-neutral-400"} ${
          isAvailable ? "animate-pulse" : ""
        }`}
      />
      {isAvailable ? "Online" : "Offline"}
    </button>
  );
}
