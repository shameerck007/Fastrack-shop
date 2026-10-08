"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptRoute } from "@/lib/actions/rider";

// Takes a whole Standard route, then opens it.
export default function AcceptRouteButton({ routeId }: { routeId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      try {
        await acceptRoute(routeId);
        router.push(`/rider/routes/${routeId}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not take this route.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        className="h-11 min-w-[8.5rem] rounded-full bg-blue-700 px-6 text-sm font-extrabold text-white shadow-md shadow-blue-700/25 transition active:scale-95 hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Taking…" : "Take route"}
      </button>
      {error && <p className="max-w-[14rem] text-end text-xs text-blue-900">{error}</p>}
    </div>
  );
}
