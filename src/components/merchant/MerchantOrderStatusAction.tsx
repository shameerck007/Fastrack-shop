"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceMerchantOrderStatus } from "@/lib/actions/merchant-orders";
import { useLocale } from "@/components/LocaleProvider";
import type { OrderStatus } from "@/types/database";

const LABEL_KEY: Partial<Record<OrderStatus, string>> = {
  pending: "merchant.confirm_order",
  confirmed: "merchant.mark_preparing",
  preparing: "merchant.mark_ready_for_pickup",
};

export default function MerchantOrderStatusAction({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useLocale();

  const labelKey = LABEL_KEY[status];
  if (!labelKey) {
    if (status === "ready_for_pickup") {
      return <p className="text-xs font-medium text-blue-700">{t("merchant.awaiting_rider_pickup")}</p>;
    }
    return null;
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await advanceMerchantOrderStatus(orderId, status);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
      >
        {t(labelKey)}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
