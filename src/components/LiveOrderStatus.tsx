"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ORDER_STATUS_FLOW } from "@/lib/utils";
import { useLocale } from "@/components/LocaleProvider";
import type { OrderStatus } from "@/types/database";

export default function LiveOrderStatus({
  orderId,
  initialStatus,
  deliveryOtp,
  statusHistory = [],
}: {
  orderId: string;
  initialStatus: OrderStatus;
  deliveryOtp: string | null;
  statusHistory?: { status: string; created_at: string }[];
}) {
  const [status, setStatus] = useState(initialStatus);
  const { t, locale } = useLocale();

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

  // Most recent entry per status, in case a status was reached more than
  // once (e.g. re-confirmed) — the timeline should show when it was last true.
  const historyByStatus = new Map<string, string>();
  for (const h of statusHistory) {
    if (!historyByStatus.has(h.status) || h.created_at > historyByStatus.get(h.status)!) {
      historyByStatus.set(h.status, h.created_at);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-start justify-end">
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            isCancelled ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"
          }`}
        >
          {t(`order_status.${status}`)}
        </span>
      </div>

      {!isCancelled && (
        <ol className="mb-6 rounded-xl border border-neutral-200 bg-white p-4">
          {ORDER_STATUS_FLOW.map((s, i) => {
            const done = i <= currentStepIndex;
            const isLast = i === ORDER_STATUS_FLOW.length - 1;
            const at = historyByStatus.get(s);
            return (
              <li key={s} className="relative flex items-start gap-3 pb-4 last:pb-0">
                {/* Label + timestamp share one line (wrapping only on very
                    narrow screens) instead of stacking, so each step takes
                    one compact row rather than the tall two-line block this
                    used to be. */}
                {!isLast && (
                  <span
                    className={`absolute top-5 h-full w-0.5 ${
                      i < currentStepIndex ? "bg-blue-700" : "bg-neutral-200"
                    } start-[9px]`}
                  />
                )}
                <span
                  className={`z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done ? "bg-blue-700 text-white" : "border-2 border-neutral-300 bg-white"
                  }`}
                >
                  {done && "✓"}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className={`text-sm font-medium ${done ? "text-neutral-900" : "text-neutral-400"}`}>
                    {t(`order_status.${s}`)}
                  </p>
                  {at && (
                    <p className="text-xs text-neutral-400">
                      {new Date(at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {deliveryOtp && !["delivered", "cancelled"].includes(status) && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="text-sm text-neutral-600">{t("orders.share_otp")}</p>
          <p className="text-2xl font-bold tracking-widest text-blue-700">{deliveryOtp}</p>
        </div>
      )}
    </>
  );
}
