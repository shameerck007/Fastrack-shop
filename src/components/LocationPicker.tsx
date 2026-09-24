"use client";

import { useState } from "react";

const RIYADH: [number, number] = [24.7136, 46.6753];
const PIN_SPAN = 0.006; // ~650m box around the pin, tight enough to read street-level detail

export default function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState(lat != null ? String(lat) : "");
  const [manualLng, setManualLng] = useState(lng != null ? String(lng) : "");

  const point: [number, number] = lat != null && lng != null ? [lat, lng] : RIYADH;
  const hasPin = lat != null && lng != null;
  const bbox = [point[1] - PIN_SPAN, point[0] - PIN_SPAN, point[1] + PIN_SPAN, point[0] + PIN_SPAN].join(",");
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${
    hasPin ? `&marker=${point[0]},${point[1]}` : ""
  }`;

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
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">
          {hasPin ? "Pin set — adjust the coordinates below if needed." : "Set your delivery location."}
        </p>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {locating ? "Locating..." : "📍 Use my current location"}
        </button>
      </div>

      <div className="h-56 w-full overflow-hidden rounded-lg border border-neutral-300">
        <iframe
          key={mapSrc}
          src={mapSrc}
          title="Location map"
          className="h-full w-full"
          loading="lazy"
        />
      </div>

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
    </div>
  );
}
