"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { updateWarehouseZone } from "@/lib/actions/admin-zones";

const RIYADH: [number, number] = [24.7136, 46.6753];

export default function ZoneEditor({
  warehouseId,
  initialLat,
  initialLng,
  initialRadiusKm,
}: {
  warehouseId: string;
  initialLat: number | null;
  initialLng: number | null;
  initialRadiusKm: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const [center, setCenter] = useState<[number, number] | null>(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : null
  );
  const [radius, setRadius] = useState(initialRadiusKm ?? 5);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const centerRef = useRef(center);
  centerRef.current = center;
  const radiusRef = useRef(radius);
  radiusRef.current = radius;

  useEffect(() => {
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
      const start = centerRef.current ?? RIYADH;
      const map = L.map(containerRef.current).setView(start, centerRef.current ? 11 : 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker(start, { icon, draggable: true }).addTo(map);
      const circle = L.circle(start, {
        radius: radiusRef.current * 1000,
        color: "#1d4ed8",
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
      if (!centerRef.current) {
        marker.setOpacity(0.5);
        circle.setStyle({ opacity: 0.4, fillOpacity: 0.05 });
      } else {
        map.fitBounds(circle.getBounds(), { padding: [20, 20] });
      }

      const move = (lat: number, lng: number) => {
        marker.setLatLng([lat, lng]);
        marker.setOpacity(1);
        circle.setLatLng([lat, lng]);
        circle.setStyle({ opacity: 1, fillOpacity: 0.15 });
        setCenter([lat, lng]);
        setMessage(null);
      };
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        move(p.lat, p.lng);
      });
      map.on("click", (e) => move(e.latlng.lat, e.latlng.lng));

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const circle = circleRef.current;
    const map = mapRef.current;
    if (!circle || !map) return;
    circle.setRadius(radius * 1000);
    if (centerRef.current) map.fitBounds(circle.getBounds(), { padding: [20, 20] });
  }, [radius]);

  function save() {
    if (!center) {
      setMessage({ ok: false, text: "Click the map (or drag the pin) to set the centre first." });
      return;
    }
    startTransition(async () => {
      try {
        await updateWarehouseZone(warehouseId, { lat: center[0], lng: center[1], radiusKm: radius });
        setMessage({ ok: true, text: "Delivery boundary saved." });
        router.refresh();
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not save." });
      }
    });
  }

  function clear() {
    if (!confirm("Remove this boundary? The store will deliver to every location.")) return;
    startTransition(async () => {
      try {
        await updateWarehouseZone(warehouseId, null);
        setMessage({ ok: true, text: "Boundary removed — this store now delivers everywhere." });
        router.refresh();
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not remove." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-neutral-500">
        Click the map or drag the pin to set the store location (centre of the circle), then choose how far it delivers.
      </p>
      <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-lg border border-neutral-300" />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-1 items-center gap-2 text-sm">
          <span className="shrink-0 text-neutral-600">Radius</span>
          <input
            type="range"
            min={0.5}
            max={50}
            step={0.5}
            value={Math.min(radius, 50)}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="flex-1"
          />
        </label>
        <div className="flex items-center gap-1 text-sm">
          <input
            type="number"
            min={0.1}
            max={200}
            step={0.1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value) || 0)}
            className="w-20 rounded-lg border border-neutral-300 px-2 py-1"
          />
          <span className="text-neutral-500">km</span>
        </div>
      </div>

      {center && (
        <p className="text-xs text-neutral-400">
          Centre: {center[0].toFixed(5)}, {center[1].toFixed(5)}
        </p>
      )}
      {message && (
        <p className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-full bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save boundary"}
        </button>
        {initialRadiusKm != null && (
          <button
            onClick={clear}
            disabled={pending}
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50"
          >
            Remove boundary
          </button>
        )}
      </div>
    </div>
  );
}
