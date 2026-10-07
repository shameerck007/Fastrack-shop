"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_URL, TILE_OPTIONS, marketGeo } from "@/lib/map-config";
import { useMarket } from "@/components/MoneyProvider";

export interface OverviewZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  color: string;
  polygon?: [number, number][] | null;
}

export interface OverviewPoint {
  lat: number;
  lng: number;
}

// Read-only map of every store's delivery circle (plus customer address
// pins, so gaps between coverage and demand are visible at a glance).
export default function ZonesOverviewMap({
  zones,
  customerPoints,
}: {
  zones: OverviewZone[];
  customerPoints: OverviewPoint[];
}) {
  const startCenter = marketGeo(useMarket().countryCode).center;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(startCenter, 10);
      L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
      L.control.scale({ imperial: false }).addTo(map);

      const bounds = L.latLngBounds([]);
      for (const z of zones) {
        const area =
          z.polygon && z.polygon.length >= 3
            ? L.polygon(z.polygon, { color: z.color, fillColor: z.color, fillOpacity: 0.14, weight: 2 })
            : L.circle([z.lat, z.lng], { radius: z.radiusKm * 1000, color: z.color, fillColor: z.color, fillOpacity: 0.14, weight: 2 });
        area.addTo(map);
        area.bindTooltip(z.polygon && z.polygon.length >= 3 ? `${z.name} — custom area` : `${z.name} — ${z.radiusKm} km`, { sticky: true });
        L.circleMarker([z.lat, z.lng], {
          radius: 6,
          color: "#fff",
          weight: 2,
          fillColor: z.color,
          fillOpacity: 1,
        })
          .addTo(map)
          .bindTooltip(z.name, { permanent: true, direction: "top", offset: [0, -6]});
        bounds.extend(area.getBounds());
      }
      for (const p of customerPoints) {
        L.circleMarker([p.lat, p.lng], {
          radius: 3,
          color: "#334155",
          weight: 1,
          fillColor: "#64748b",
          fillOpacity: 0.7,
        }).addTo(map);
      }
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="h-80 w-full overflow-hidden rounded-xl border border-neutral-200 md:h-[26rem]" />;
}
