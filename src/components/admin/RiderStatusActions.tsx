"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveRider, rejectRider, suspendRider, reinstateRider } from "@/lib/actions/admin-riders";
import { useLocale } from "@/components/LocaleProvider";

export default function RiderStatusActions({ riderId, status }: { riderId: string; status: string }) {
  const { t } = useLocale();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("store_status.action_failed"));
      }
    });
  }

  if (showReject) {
    return (
      <div className="flex flex-col gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("store_status.reason_optional")}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => run(() => rejectRider(riderId, reason))}
            disabled={pending}
            className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {t("store_status.confirm_reject")}
          </button>
          <button
            onClick={() => setShowReject(false)}
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            {t("common.cancel")}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-2">
        {status === "pending" && (
          <>
            <button
              onClick={() => run(() => approveRider(riderId))}
              disabled={pending}
              className="rounded-full bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {t("store_status.approve")}
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={pending}
              className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              {t("store_status.reject")}
            </button>
          </>
        )}
        {status === "approved" && (
          <button
            onClick={() => run(() => suspendRider(riderId))}
            disabled={pending}
            className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            {t("store_status.suspend")}
          </button>
        )}
        {status === "suspended" && (
          <button
            onClick={() => run(() => reinstateRider(riderId))}
            disabled={pending}
            className="rounded-full bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {t("store_status.reinstate")}
          </button>
        )}
        {status === "rejected" && (
          <button
            onClick={() => run(() => approveRider(riderId))}
            disabled={pending}
            className="rounded-full bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {t("store_status.approve_anyway")}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
