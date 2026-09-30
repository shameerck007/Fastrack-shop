"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptOrder } from "@/lib/actions/rider";
import { useLocale } from "@/components/LocaleProvider";

export default function AcceptOrderButton({ orderId }: { orderId: string }) {
  const { t } = useLocale();
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
        setError(err instanceof Error ? err.message : t("rider.could_not_accept"));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleAccept}
        disabled={pending}
        className="rounded-full bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("rider.accepting") : t("rider.accept")}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
