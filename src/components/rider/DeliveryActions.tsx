"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPickedUp, completeDelivery } from "@/lib/actions/rider";
import { useLocale } from "@/components/LocaleProvider";
import type { OrderStatus } from "@/types/database";

export default function DeliveryActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const { t } = useLocale();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handlePickedUp() {
    startTransition(async () => {
      await markPickedUp(orderId);
      router.refresh();
    });
  }

  function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await completeDelivery(orderId, otp);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("rider.could_not_complete"));
      }
    });
  }

  if (status === "delivered") {
    return <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{t("rider.delivered_check")}</p>;
  }

  if (status === "rider_assigned" || status === "ready_for_pickup") {
    return (
      <button
        onClick={handlePickedUp}
        disabled={pending}
        className="w-full rounded-full bg-blue-700 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {t("rider.mark_picked_up")}
      </button>
    );
  }

  if (status === "out_for_delivery") {
    return (
      <form onSubmit={handleComplete} className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("rider.enter_otp_label")}</label>
        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          maxLength={4}
          placeholder={t("rider.otp_placeholder")}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-lg tracking-widest"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending || otp.length !== 4}
          className="rounded-full bg-blue-700 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("rider.verifying") : t("rider.complete_delivery")}
        </button>
      </form>
    );
  }

  return <p className="text-sm text-neutral-500">{t("rider.waiting_for_store")}</p>;
}
