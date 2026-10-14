"use client";


import { errorText, unwrapAction } from "@/lib/errors";
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
      return <p className="rounded-xl bg-brand-50 px-3 py-2.5 text-center text-sm font-semibold text-brand-800">{t("merchant.awaiting_rider_pickup")}</p>;
    }
    return null;
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await unwrapAction(advanceMerchantOrderStatus)(orderId, status);
        router.refresh();
      } catch (e) {
        setError(errorText(e, "Something went wrong."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* A big button across the card: easy to hit with a thumb, even with wet hands in a busy shop. */}
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-700 px-6 text-base font-extrabold text-white shadow-md shadow-brand-700/20 transition hover:bg-brand-800 active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Please wait…" : t(labelKey)}
      </button>
      {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
    </div>
  );
}
