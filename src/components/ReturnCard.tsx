"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelReturn } from "@/lib/actions/returns";
import { errorText, unwrapAction } from "@/lib/errors";
import { RETURN_STATUS, reasonLabel, type ReturnRow } from "@/lib/returns";
import { useMoney } from "@/components/MoneyProvider";

/** One return on the customer's order page: where it is, the code to show the rider, and a way to cancel. */
export default function ReturnCard({ orderId, ret, itemName }: { orderId: string; ret: ReturnRow; itemName: string }) {
  const router = useRouter();
  const money = useMoney();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const s = RETURN_STATUS[ret.status];
  const canCancel = ["requested", "approved", "pickup_assigned"].includes(ret.status);

  function cancel() {
    setError(null);
    start(async () => {
      try {
        await unwrapAction(cancelReturn)(orderId, ret.id);
        router.refresh();
      } catch (e) {
        setError(errorText(e, "Could not cancel the return."));
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {itemName} × {ret.quantity}
          </p>
          <p className="text-xs text-neutral-500">
            Return {ret.return_number} · {reasonLabel(ret.reason)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${s.tone}`}>{s.customer}</span>
      </div>
      {ret.status === "pickup_assigned" && (
        <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-center">
          <p className="text-xs text-neutral-600">Give this code to the rider when they collect the item</p>
          <p className="text-2xl font-extrabold tracking-[0.35em] text-brand-800">{ret.pickup_code}</p>
        </div>
      )}
      {ret.status === "approved" && ret.resolution === "pickup" && <p className="mt-2 text-xs text-neutral-600">We are arranging a rider. You will see a code here when one is on the way.</p>}
      {ret.status === "refunded" && ret.refund_amount != null && <p className="mt-2 text-sm font-semibold text-emerald-700">{money(Number(ret.refund_amount))} refunded{ret.resolution === "keep" ? ". You can keep the item." : "."}</p>}
      {ret.status === "rejected" && ret.admin_note && <p className="mt-2 text-sm text-rose-700">{ret.admin_note}</p>}
      {canCancel && (
        <button type="button" onClick={cancel} disabled={pending} className="mt-2 text-xs font-semibold text-neutral-500 underline-offset-2 hover:text-rose-600 hover:underline disabled:opacity-50">
          {pending ? "Cancelling…" : "Cancel this return"}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
