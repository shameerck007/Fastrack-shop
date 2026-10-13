"use client";


import { errorText, unwrapAction } from "@/lib/errors";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceWarehouseOrderStatus } from "@/lib/actions/warehouse-staff";
import { useLocale } from "@/components/LocaleProvider";
import PackDialog from "@/components/warehouse/PackDialog";
import type { OrderStatus } from "@/types/database";

const LABEL_KEY: Partial<Record<OrderStatus, string>> = {
  pending: "merchant.confirm_order",
  confirmed: "merchant.mark_preparing",
  preparing: "merchant.mark_ready_for_pickup",
};

export default function WarehouseOrderStatusAction({ orderId, orderNumber, status, requirePackScan = false }: { orderId: string; orderNumber: string; status: OrderStatus; requirePackScan?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [packing, setPacking] = useState(false);
  const { t } = useLocale();

  const labelKey = LABEL_KEY[status];
  if (!labelKey) {
    if (status === "ready_for_pickup") {
      return <p className="text-xs font-medium text-brand-700">{t("merchant.awaiting_rider_pickup")}</p>;
    }
    return null;
  }

  async function packed(): Promise<string | void> {
    try {
      await unwrapAction(advanceWarehouseOrderStatus)(orderId, status, true);
      router.refresh();
    } catch (e) {
      return errorText(e, "Something went wrong.");
    }
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await unwrapAction(advanceWarehouseOrderStatus)(orderId, status);
        router.refresh();
      } catch (e) {
        setError(errorText(e, "Something went wrong."));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {status === "preparing" && (
        <button type="button" onClick={() => setPacking(true)} className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-800">
          📷 Pack &amp; scan
        </button>
      )}
      {!(status === "preparing" && requirePackScan) && (
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {t(labelKey)}
        </button>
      )}
      {packing && <PackDialog orderId={orderId} orderNumber={orderNumber} onClose={() => setPacking(false)} onPacked={packed} />}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
