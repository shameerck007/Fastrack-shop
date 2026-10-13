"use client";


import { errorText, unwrapAction } from "@/lib/errors";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveStore, rejectStore } from "@/lib/actions/admin-merchants";

export default function StoreApprovalActions({ storeId }: { storeId: string }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await unwrapAction(approveStore)(storeId);
        router.refresh();
      } catch (err) {
        setError(errorText(err, "Could not approve store."));
      }
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      try {
        await unwrapAction(rejectStore)(storeId, reason);
        router.refresh();
      } catch (err) {
        setError(errorText(err, "Could not reject store."));
      }
    });
  }

  if (showReject) {
    return (
      <div className="flex flex-col gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
        />
        <div className="flex gap-2">
          <button
            onClick={handleReject}
            disabled={pending}
            className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Confirm reject
          </button>
          <button
            onClick={() => setShowReject(false)}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={pending}
          className="rounded-full bg-brand-700 px-3 py-1 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => setShowReject(true)}
          disabled={pending}
          className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          Reject
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
