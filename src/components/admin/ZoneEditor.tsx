"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { updateWarehouseZone } from "@/lib/actions/admin-zones";
import PlaceSearch from "@/components/PlaceSearch";
import {
  TILE_URL,
  TILE_OPTIONS,
  MARKER_ICON,
  DEFAULT_CENTER,
  searchPlaces,
  type PlaceResult,
} from "@/lib/map-config";

const PRESETS = [1, 2, 3, 5, 8, 10, 15, 20];

export default function ZoneEditor({
  warehouseId,
  storeAddress,
  initialLat,
  initialLng,
  initialRadiusKm,
}: {
  warehouseId: string;
  storeAddress: string | null;
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const centerRef = useRef(center);
  centerRef.current = center;
  const radiusRef = useRef(radius);
  radiusRef.current = radius;
  const moveRef = useRef<(lat: number, lng: number, zoom?: number) => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const start = centerRef.current ?? DEFAULT_CENTER;
      const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(start, centerRef.current ? 11 : 10);
      L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
      L.control.scale({ imperial: false }).addTo(map);

      const marker = L.marker(start, { icon: L.icon(MARKER_ICON), draggable: true }).addTo(map);
      const circle = L.circle(start, {
        radius: radiusRef.current * 1000,
        color: "#1d4ed8",
        fillColor: "#3b82f6",
        fillOpacity: 0.18,
        weight: 2,
      }).addTo(map);
      if (!centerRef.current) {
        marker.setOpacity(0.45);
        circle.setStyle({ opacity: 0.35, fillOpacity: 0.05 });
      } else {
        map.fitBounds(circle.getBounds(), { padding: [24, 24] });
      }

      moveRef.current = (lat, lng, zoom) => {
        marker.setLatLng([lat, lng]);
        marker.setOpacity(1);
        circle.setLatLng([lat, lng]);
        circle.setStyle({ opacity: 1, fillOpacity: 0.18 });
        setCenter([lat, lng]);
        setMessage(null);
        if (zoom) map.setView([lat, lng], zoom);
        else map.fitBounds(circle.getBounds(), { padding: [24, 24] });
      };
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        setCenter([p.lat, p.lng]);
        circle.setLatLng(p);
        setMessage(null);
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        marker.setOpacity(1);
        circle.setLatLng(e.latlng);
        circle.setStyle({ opacity: 1, fillOpacity: 0.18 });
        setCenter([e.latlng.lat, e.latlng.lng]);
        setMessage(null);
      });

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
    circle.setRadius(Math.max(radius, 0.1) * 1000);
    if (centerRef.current) map.fitBounds(circle.getBounds(), { padding: [24, 24] });
  }, [radius]);

  function pickPlace(place: PlaceResult) {
    moveRef.current(place.lat, place.lng);
  }

  async function useStoreAddress() {
    if (!storeAddress) return;
    setBusy(true);
    setMessage(null);
    try {
      const results = await searchPlaces(storeAddress);
      if (results.length === 0) {
        setMessage({ ok: false, text: "Couldn't find that address on the map — search for a nearby area instead." });
      } else {
        moveRef.current(results[0].lat, results[0].lng);
        setMessage({ ok: true, text: `Placed near "${results[0].label}". Drag the pin to fine-tune, then save.` });
      }
    } catch {
      setMessage({ ok: false, text: "Address search is unavailable right now." });
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        moveRef.current(pos.coords.latitude, pos.coords.longitude);
        setBusy(false);
      },
      () => {
        setMessage({ ok: false, text: "Couldn't read your location — allow location access or use the search." });
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function save() {
    if (!center) {
      setMessage({ ok: false, text: "Set the store location first: search, or click the map." });
      return;
    }
    startTransition(async () => {
      try {
        await updateWarehouseZone(warehouseId, { lat: center[0], lng: center[1], radiusKm: radius });
        setMessage({ ok: true, text: "Delivery boundary saved. It applies to customers immediately." });
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

  const areaKm2 = Math.PI * radius * radius;

  return (
    <div className="flex flex-col gap-3">
      <ol className="grid gap-2 text-xs text-neutral-600 sm:grid-cols-3">
        <li className="rounded-lg bg-neutral-50 p-2">
          <b>1. Locate the store</b>
          <br />
          Search below, click the map, drag the pin, or tap 🎯 on the map for your current location.
        </li>
        <li className="rounded-lg bg-neutral-50 p-2">
          <b>2. Set the radius</b>
          <br />
          Pick a preset or use the slider.
        </li>
        <li className="rounded-lg bg-neutral-50 p-2">
          <b>3. Save</b>
          <br />
          Customers outside the circle can&apos;t order.
        </li>
      </ol>

      <PlaceSearch onSelect={pickPlace} />

      {storeAddress && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={useStoreAddress}
            disabled={busy}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            🏪 Use store address
          </button>
          <p className="text-xs text-neutral-400">On file: {storeAddress}</p>
        </div>
      )}

      <div className="relative">
        <div ref={containerRef} className="h-80 w-full overflow-hidden rounded-lg border border-neutral-300 md:h-[26rem]" />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          title="Locate me"
          aria-label="Use my current location"
          className="absolute bottom-3 right-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 bg-white text-base shadow-md transition hover:bg-neutral-50 disabled:opacity-50"
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
          ) : (
            "🎯"
          )}
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRESETS.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => setRadius(km)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                radius === km ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              {km} km
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="range"
            min={0.5}
            max={50}
            step={0.5}
            value={Math.min(radius, 50)}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="min-w-[10rem] flex-1"
          />
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
        <p className="mt-2 text-xs text-neutral-500">
          Covers about <b>{areaKm2.toFixed(0)} km²</b> ({(radius * 2).toFixed(1)} km across)
          {center && (
            <>
              {" "}
              · centre {center[0].toFixed(4)}, {center[1].toFixed(4)}
            </>
          )}
        </p>
      </div>

      {message && <p className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-full bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save boundary"}
        </button>
        {initialRadiusKm != null && (
          <button
            onClick={clear}
            disabled={pending}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50"
          >
            Remove boundary
          </button>
        )}
      </div>
    </div>
  );
}
