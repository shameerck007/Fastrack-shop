"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

export default function LiveOrderStatus({
  orderId,
  initialStatus,
  deliveryOtp,
}: {
  orderId: string;
  initialStatus: OrderStatus;
  deliveryOtp: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // See RiderLocationMap for why the session must be awaited before
    // subscribing — otherwise the realtime socket connects as anon and
    // RLS drops every event.
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`order-status-${orderId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
          (payload) => {
            const next = payload.new as { status: OrderStatus };
            if (next.status) setStatus(next.status);
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orderId]);

  const isCancelled = status === "cancelled";
  const currentStepIndex = ORDER_STATUS_FLOW.indexOf(status as (typeof ORDER_STATUS_FLOW)[number]);

  return (
    <>
      <div className="mb-4 flex items-start justify-end">
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            isCancelled ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"
          }`}
        >
          {ORDER_STATUS_LABELS[status]}
        </span>
      </div>

      {!isCancelled && (
        <ol className="mb-6 flex flex-col gap-2">
          {ORDER_STATUS_FLOW.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${i <= currentStepIndex ? "bg-blue-700" : "bg-neutral-300"}`} />
              <span className={i <= currentStepIndex ? "text-neutral-900" : "text-neutral-400"}>
                {ORDER_STATUS_LABELS[s]}
              </span>
            </li>
          ))}
        </ol>
      )}

      {deliveryOtp && !["delivered", "cancelled"].includes(status) && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="text-sm text-neutral-600">Share this OTP with your rider on arrival</p>
          <p className="text-2xl font-bold tracking-widest text-blue-700">{deliveryOtp}</p>
        </div>
      )}
    </>
  );
}
