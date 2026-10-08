"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markRoutePickedUp } from "@/lib/actions/rider";

// At the shop: one tap marks every order on the route as picked up and on its way.
export default function RoutePickupButton({ routeId, count }: { routeId: string; count: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickUp() {
    setError(null);
    startTransition(async () => {
      try {
        await markRoutePickedUp(routeId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update the route.");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={pickUp}
        disabled={pending}
        className="h-12 w-full rounded-full bg-blue-700 text-base font-extrabold text-white shadow-lg shadow-blue-700/25 active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Updating…" : `I have all ${count} ${count === 1 ? "order" : "orders"}: start delivering`}
      </button>
      {error && <p className="mt-2 text-center text-xs text-blue-900">{error}</p>}
    </div>
  );
}
