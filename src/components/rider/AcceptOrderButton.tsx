"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptOrder } from "@/lib/actions/rider";

export default function AcceptOrderButton({ orderId }: { orderId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      try {
        await acceptOrder(orderId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not accept this order.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleAccept}
        disabled={pending}
        className="rounded-full bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Accepting..." : "Accept"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
