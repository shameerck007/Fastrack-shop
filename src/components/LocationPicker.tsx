"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import PlaceSearch from "@/components/PlaceSearch";
import { TILE_URL, TILE_OPTIONS, MARKER_ICON, DEFAULT_CENTER, type PlaceResult } from "@/lib/map-config";
import { useLocale } from "@/components/LocaleProvider";


export default function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const { t } = useLocale();
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

      const icon = L.icon(MARKER_ICON);

      const start: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
      const map = L.map(containerRef.current).setView(start, lat != null && lng != null ? 15 : 11);
      L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);

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
      setError(t("common.geolocation_not_supported"));
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
        setError(t("common.couldnt_get_location_short"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function selectPlace(place: PlaceResult) {
    onChange(place.lat, place.lng);
    setManualLat(String(place.lat));
    setManualLng(String(place.lng));
    setError(null);
    mapRef.current?.setView([place.lat, place.lng], 16);
    markerRef.current?.setLatLng([place.lat, place.lng]);
  }

  function applyManual() {
    const newLat = Number(manualLat);
    const newLng = Number(manualLng);
    if (Number.isNaN(newLat) || Number.isNaN(newLng)) {
      setError(t("common.invalid_lat_lng"));
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
        <p className="text-xs text-neutral-500">{t("common.drag_pin_hint")}</p>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {locating ? t("common.locating") : t("common.use_my_current_location")}
        </button>
      </div>

      <PlaceSearch onSelect={selectPlace} />

      <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-lg border border-neutral-300" />

      <div className="flex items-center gap-2">
        <input
          value={manualLat}
          onChange={(e) => setManualLat(e.target.value)}
          placeholder={t("common.latitude")}
          inputMode="decimal"
          className="w-1/2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={manualLng}
          onChange={(e) => setManualLng(e.target.value)}
          placeholder={t("common.longitude")}
          inputMode="decimal"
          className="w-1/2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={applyManual}
          className="shrink-0 rounded-full border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100"
        >
          {t("common.apply")}
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
