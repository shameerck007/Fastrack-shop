"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Keeps the orders dashboard (KPIs + queue board + table) live without
// polling: subscribes to changes on the orders table and asks Next.js to
// re-run this server page, which re-fetches fresh data via the existing
// admin-orders queries. Debounced so a burst of updates (e.g. bulk status
// changes) triggers one refresh, not one per row.
export default function OrdersLiveRefresher() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    function refreshSoon() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => router.refresh(), 600);
    }

    // The session must be awaited before subscribing — otherwise the
    // realtime socket connects as anon and RLS drops every event.
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel("admin-orders-dashboard")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refreshSoon)
        .subscribe((status) => {
          if (!cancelled) setConnected(status === "SUBSCRIBED");
        });
    });

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`} />
      {connected ? "Live" : "Connecting…"}
    </span>
  );
}
