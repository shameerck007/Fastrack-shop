"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PIN_SPAN = 0.008;

export default function RiderLocationMap({
  riderId,
  initialLat,
  initialLng,
}: {
  riderId: string;
  initialLat: number | null;
  initialLng: number | null;
}) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // The realtime socket authenticates with whatever session the client
    // has at connect time; with cookie-based (@supabase/ssr) storage that
    // session hasn't finished hydrating yet on mount, so subscribing
    // immediately connects as anon and RLS silently drops every event.
    // Awaiting the session first ensures the socket authenticates properly.
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`rider-location-${riderId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "delivery_partners", filter: `id=eq.${riderId}` },
          (payload) => {
            const next = payload.new as { current_lat: number | null; current_lng: number | null };
            if (next.current_lat != null && next.current_lng != null) {
              setLat(next.current_lat);
              setLng(next.current_lng);
              setLive(true);
            }
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [riderId]);

  if (lat == null || lng == null) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-xs text-neutral-400">
        Waiting for the rider&apos;s location...
      </div>
    );
  }

  const bbox = [lng - PIN_SPAN, lat - PIN_SPAN, lng + PIN_SPAN, lat + PIN_SPAN].join(",");
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-500">Rider location</p>
        <span className={`flex items-center gap-1 text-xs ${live ? "text-emerald-600" : "text-neutral-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-neutral-300"}`} />
          {live ? "Live" : "Last known"}
        </span>
      </div>
      <div className="h-48 w-full overflow-hidden rounded-lg border border-neutral-200">
        <iframe key={`${lat},${lng}`} src={mapSrc} title="Rider location" className="h-full w-full" loading="lazy" />
      </div>
    </div>
  );
}
