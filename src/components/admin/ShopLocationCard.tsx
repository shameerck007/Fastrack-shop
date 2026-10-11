"use client";

import Glyph from "@/components/ui/Glyph";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_URL, TILE_OPTIONS, MARKER_ICON } from "@/lib/map-config";
import { PinModal, type AreaShopRow } from "@/components/admin/AreaShops";

/** A shop's or warehouse's GPS pin on a small map, with the delivery zone it falls in and a button to move the pin. */
export default function ShopLocationCard({
  warehouseId,
  name,
  lat,
  lng,
  areaName,
  zoning,
  address,
}: {
  warehouseId: string | null;
  name: string;
  lat: number | null;
  lng: number | null;
  /** The delivery zone the pin sits in, when zones are in use. */
  areaName: string | null;
  /** "zones" when common delivery zones are in use, else "legacy". */
  zoning: "zones" | "legacy";
  address?: string | null;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [moving, setMoving] = useState(false);
  const has = lat != null && lng != null;

  useEffect(() => {
    if (!has || !containerRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      mapRef.current?.remove();
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false }).setView([lat as number, lng as number], 15);
      L.tileLayer(TILE_URL, { ...TILE_OPTIONS, attribution: "" }).addTo(map);
      L.marker([lat as number, lng as number], { icon: L.icon(MARKER_ICON) }).addTo(map);
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [has, lat, lng]);

  const row = { id: warehouseId ?? "", name, lat, lng } as unknown as AreaShopRow;

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative isolate h-44 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
        {has ? (
          <div ref={containerRef} className="h-full w-full" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-neutral-500">
            <span className="text-blue-600"><Glyph icon="gps" className="h-9 w-9" /></span>
            No GPS pin yet
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col justify-between gap-3 text-sm">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">GPS location</p>
          <p className="font-mono text-sm font-semibold text-neutral-900">{has ? `${(lat as number).toFixed(6)}, ${(lng as number).toFixed(6)}` : "Not set"}</p>
          {address && <p className="truncate text-xs text-neutral-500">{address}</p>}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {has && zoning === "zones" && (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${areaName ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"}`}>
                {areaName ? `Zone: ${areaName}` : "Outside every delivery zone"}
              </span>
            )}
            {!has && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Not live until a pin is set</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {warehouseId ? (
            <button type="button" onClick={() => setMoving(true)} className="h-9 rounded-full bg-blue-700 px-4 text-xs font-bold text-white hover:bg-blue-800">
              {has ? "Adjust pin" : "Set pin"}
            </button>
          ) : (
            <span className="text-xs text-neutral-400">The pickup point is created when the shop is approved.</span>
          )}
          {has && (
            <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full border border-neutral-300 px-4 text-xs font-bold text-neutral-700 hover:bg-neutral-50">
              Open in Google Maps ↗
            </a>
          )}
        </div>
      </div>

      {moving && warehouseId && (
        <PinModal
          row={row}
          onClose={() => setMoving(false)}
          onSaved={() => {
            setMoving(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
