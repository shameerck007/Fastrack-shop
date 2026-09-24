"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

const RIYADH: [number, number] = [24.7136, 46.6753];

export default function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState(lat != null ? String(lat) : "");
  const [manualLng, setManualLng] = useState(lng != null ? String(lng) : "");

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

      const start: [number, number] = lat != null && lng != null ? [lat, lng] : RIYADH;
      const map = L.map(containerRef.current).setView(start, lat != null && lng != null ? 15 : 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker(start, { icon, draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChange(pos.lat, pos.lng);
        setManualLat(String(pos.lat));
        setManualLng(String(pos.lng));
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        onChange(e.latlng.lat, e.latlng.lng);
        setManualLat(String(e.latlng.lat));
        setManualLng(String(e.latlng.lng));
      });

      mapRef.current = map;
      markerRef.current = marker;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation isn't supported on this device.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onChange(latitude, longitude);
        setManualLat(String(latitude));
        setManualLng(String(longitude));
        mapRef.current?.setView([latitude, longitude], 16);
        markerRef.current?.setLatLng([latitude, longitude]);
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location — check that location access is allowed for this site.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function applyManual() {
    const newLat = Number(manualLat);
    const newLng = Number(manualLng);
    if (Number.isNaN(newLat) || Number.isNaN(newLng)) {
      setError("Enter valid latitude and longitude numbers.");
      return;
    }
    setError(null);
    onChange(newLat, newLng);
    mapRef.current?.setView([newLat, newLng], 16);
    markerRef.current?.setLatLng([newLat, newLng]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">Drag the pin or tap the map to set your exact location.</p>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {locating ? "Locating..." : "📍 Use my current location"}
        </button>
      </div>

      <div ref={containerRef} className="h-56 w-full overflow-hidden rounded-lg border border-neutral-300" />

      <div className="flex items-center gap-2">
        <input
          value={manualLat}
          onChange={(e) => setManualLat(e.target.value)}
          placeholder="Latitude"
          inputMode="decimal"
          className="w-1/2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={manualLng}
          onChange={(e) => setManualLng(e.target.value)}
          placeholder="Longitude"
          inputMode="decimal"
          className="w-1/2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={applyManual}
          className="shrink-0 rounded-full border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100"
        >
          Apply
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {lat != null && lng != null && (
        <p className="text-xs text-neutral-400">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
      )}
    </div>
  );
}
