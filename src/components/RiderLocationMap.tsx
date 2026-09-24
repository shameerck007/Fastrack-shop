"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { createClient } from "@/lib/supabase/client";

export default function RiderLocationMap({
  riderId,
  initialLat,
  initialLng,
}: {
  riderId: string;
  initialLat: number | null;
  initialLng: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [live, setLive] = useState(false);
  const hasPosition = lat != null && lng != null;

  // Initialize the map once we have a first position (initial or the first
  // realtime update), then just move the existing marker/view afterward —
  // avoids remounting the whole map on every location update.
  useEffect(() => {
    if (!hasPosition || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      const start: [number, number] = [lat as number, lng as number];
      const map = L.map(containerRef.current, { zoomControl: true }).setView(start, 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      markerRef.current = L.marker(start, { icon }).addTo(map);
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPosition]);

  // Move the marker/view whenever lat/lng change after the map exists.
  useEffect(() => {
    if (lat == null || lng == null || !mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.panTo([lat, lng]);
  }, [lat, lng]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

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

  if (!hasPosition) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-xs text-neutral-400">
        Waiting for the rider&apos;s location...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-500">Rider location</p>
        <span className={`flex items-center gap-1 text-xs ${live ? "text-emerald-600" : "text-neutral-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-neutral-300"}`} />
          {live ? "Live" : "Last known"}
        </span>
      </div>
      <div ref={containerRef} className="h-48 w-full overflow-hidden rounded-lg border border-neutral-200" />
    </div>
  );
}
