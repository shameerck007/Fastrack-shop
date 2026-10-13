"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_URL, TILE_OPTIONS, marketGeo } from "@/lib/map-config";
import { useMarket } from "@/components/MoneyProvider";
import { BRAND } from "@/lib/brand";

export interface MapTarget {
  lat: number;
  lng: number;
  zoom?: number;
  /** Change this to fly the map to the target again, even when the coordinates are the same. */
  nonce: number;
}

/**
 * A map with the pin fixed in the middle, the way Keeta and Noon Minutes do it: the shopper drags the map under the pin
 * and the spot under the pin is the delivery location. It reports the new centre when the map stops moving.
 */
export default function PinMap({ lat, lng, onMove, target }: { lat: number | null; lng: number | null; onMove: (lat: number, lng: number) => void; target?: MapTarget | null }) {
  const start = marketGeo(useMarket().countryCode).center;
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const onMoveRef = useRef(onMove);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    onMoveRef.current = onMove;
  });

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !ref.current || mapRef.current) return;
      const from: [number, number] = lat != null && lng != null ? [lat, lng] : start;
      const map = L.map(ref.current, { zoomControl: false, attributionControl: true }).setView(from, lat != null && lng != null ? 17 : 13);
      L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
      map.attributionControl.setPrefix(false);
      map.on("movestart", () => setMoving(true));
      map.on("moveend", () => {
        setMoving(false);
        const c = map.getCenter();
        onMoveRef.current(c.lat, c.lng);
      });
      mapRef.current = map;
      // Report where the pin starts, so the label and the delivery check are filled in at once.
      onMoveRef.current(from[0], from[1]);
      setTimeout(() => map.invalidateSize(), 50);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!target || !mapRef.current) return;
    mapRef.current.flyTo([target.lat, target.lng], target.zoom ?? 17, { duration: 0.8 });
  }, [target]);

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="absolute inset-0 z-0" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2">
        <div className={`-translate-y-full transition-transform duration-150 ${moving ? "-translate-y-[130%]" : ""}`}>
          <svg width="40" height="52" viewBox="0 0 40 52" className="drop-shadow-lg">
            <path d="M20 0C9 0 0 8.8 0 19.7 0 33.5 20 52 20 52s20-18.5 20-32.3C40 8.8 31 0 20 0z" fill={BRAND[700]} />
            <circle cx="20" cy="19.5" r="7.5" fill="#fff" />
          </svg>
        </div>
        <div className={`absolute left-1/2 top-0 h-2 w-5 -translate-x-1/2 rounded-full bg-black/25 blur-[2px] transition-all duration-150 ${moving ? "scale-75 opacity-40" : ""}`} />
      </div>
    </div>
  );
}
