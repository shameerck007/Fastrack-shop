"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Circle, LayerGroup, Map as LeafletMap, Marker, Polygon, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import { updateWarehouseZone } from "@/lib/actions/admin-zones";
import PlaceSearch from "@/components/PlaceSearch";
import {
  TILE_URL,
  TILE_OPTIONS,
  MARKER_ICON,
  marketGeo,
  searchPlaces,
  type PlaceResult,
} from "@/lib/map-config";
import { useLocale } from "@/components/LocaleProvider";
import { useMarket } from "@/components/MoneyProvider";
import { MAX_POINTS, polygonAreaKm2, polygonCenter, polygonProblem, type LatLng } from "@/lib/geo-polygon";

const PRESETS = [1, 2, 3, 5, 8, 10, 15, 20];

export default function ZoneEditor({
  warehouseId,
  storeAddress,
  initialLat,
  initialLng,
  initialRadiusKm,
  initialPolygon = null,
}: {
  warehouseId: string;
  storeAddress: string | null;
  initialLat: number | null;
  initialLng: number | null;
  initialRadiusKm: number | null;
  /** A custom Express area saved earlier (list of [lat, lng]). */
  initialPolygon?: LatLng[] | null;
}) {
  const { t } = useLocale();
  const startCenter = marketGeo(useMarket().countryCode).center;
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

  // Custom area: click the map to add points, drag a point to move it, double-click a point to remove it.
  const [mode, setMode] = useState<"circle" | "area">(initialPolygon && initialPolygon.length >= 3 ? "area" : "circle");
  const [points, setPoints] = useState<LatLng[]>(initialPolygon ?? []);
  const [mapReady, setMapReady] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const areaGroupRef = useRef<LayerGroup | null>(null);
  const shapeRef = useRef<Polygon | Polyline | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const start = centerRef.current ?? startCenter;
      const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(start, centerRef.current ? 11 : 10);
      L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
      L.control.scale({ imperial: false }).addTo(map);

      leafletRef.current = L;
      areaGroupRef.current = L.layerGroup().addTo(map);
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
        if (modeRef.current === "area") {
          setPoints((prev) => (prev.length >= MAX_POINTS ? prev : [...prev, [e.latlng.lat, e.latlng.lng] as LatLng]));
          setMessage(null);
          return;
        }
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
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw the custom area (shape + draggable corner points) whenever the points or the mode change.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = areaGroupRef.current;
    const circle = circleRef.current;
    if (!L || !map || !group || !circle) return;
    group.clearLayers();
    shapeRef.current = null;
    if (mode !== "area") {
      circle.setStyle({ opacity: centerRef.current ? 1 : 0.35, fillOpacity: centerRef.current ? 0.18 : 0.05 });
      return;
    }
    circle.setStyle({ opacity: 0, fillOpacity: 0 });
    const style = { color: "#7c3aed", fillColor: "#8b5cf6", fillOpacity: 0.2, weight: 2 };
    const shape = points.length >= 3 ? L.polygon(points, style) : L.polyline(points, { color: "#7c3aed", weight: 2, dashArray: "6 6" });
    shape.addTo(group);
    shapeRef.current = shape;
    const dot = L.divIcon({
      className: "",
      html: '<div style="width:16px;height:16px;border-radius:9999px;background:#fff;border:3px solid #7c3aed;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    points.forEach((pt, i) => {
      const m = L.marker(pt, { icon: dot, draggable: true, title: "Drag to move. Double-click to remove." }).addTo(group);
      m.on("drag", () => {
        const ll = m.getLatLng();
        const next = points.map((q, k) => (k === i ? ([ll.lat, ll.lng] as LatLng) : q));
        (shapeRef.current as Polygon | Polyline | null)?.setLatLngs(next);
      });
      m.on("dragend", () => {
        const ll = m.getLatLng();
        setPoints((prev) => prev.map((q, k) => (k === i ? ([ll.lat, ll.lng] as LatLng) : q)));
        setMessage(null);
      });
      m.on("dblclick", (ev) => {
        L.DomEvent.stopPropagation(ev);
        setPoints((prev) => prev.filter((_, k) => k !== i));
        setMessage(null);
      });
    });
  }, [mode, points, mapReady]);

  useEffect(() => {
    const circle = circleRef.current;
    const map = mapRef.current;
    if (!circle || !map || modeRef.current === "area") return;
    circle.setRadius(Math.max(radius, 0.1) * 1000);
    if (centerRef.current) map.fitBounds(circle.getBounds(), { padding: [24, 24] });
  }, [radius]);

  // Start the shape from the current circle (12 points) so it can be reshaped instead of drawn from nothing.
  function startFromCircle() {
    const map = mapRef.current;
    const c = centerRef.current ?? (map ? ([map.getCenter().lat, map.getCenter().lng] as LatLng) : null);
    if (!c) return;
    const r = Math.max(radiusRef.current, 0.5);
    const kmLat = 111.32;
    const kmLng = 111.32 * Math.cos((c[0] * Math.PI) / 180);
    const pts: LatLng[] = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * 2 * Math.PI;
      return [c[0] + (r * Math.sin(a)) / kmLat, c[1] + (r * Math.cos(a)) / kmLng] as LatLng;
    });
    setPoints(pts);
    setMode("area");
    setMessage(null);
    map?.fitBounds(pts, { padding: [24, 24] });
  }

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
        setMessage({ ok: false, text: t("zone_editor.couldnt_find_address") });
      } else {
        moveRef.current(results[0].lat, results[0].lng);
        setMessage({ ok: true, text: t("zone_editor.placed_near", { label: results[0].label }) });
      }
    } catch {
      setMessage({ ok: false, text: t("zone_editor.address_search_unavailable") });
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
        setMessage({ ok: false, text: t("zone_editor.couldnt_read_location") });
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function save() {
    if (mode === "area") {
      const problem = polygonProblem(points);
      if (points.length < 3 || problem) {
        setMessage({ ok: false, text: problem ?? "Draw at least 3 points on the map to make an area." });
        return;
      }
    }
    if (!center && mode !== "area") {
      setMessage({ ok: false, text: t("zone_editor.set_location_first") });
      return;
    }
    startTransition(async () => {
      try {
        const polygon = mode === "area" ? points : null;
        const pin = polygon ? polygonCenter(polygon) : (center as [number, number]);
        await updateWarehouseZone(warehouseId, { lat: pin[0], lng: pin[1], radiusKm: radius, polygon });
        setMessage({ ok: true, text: t("zone_editor.boundary_saved") });
        router.refresh();
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : t("zone_editor.could_not_save") });
      }
    });
  }

  function clear() {
    if (!confirm(t("zone_editor.confirm_remove"))) return;
    startTransition(async () => {
      try {
        await updateWarehouseZone(warehouseId, null);
        setMessage({ ok: true, text: t("zone_editor.boundary_removed") });
        router.refresh();
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : t("zone_editor.could_not_remove") });
      }
    });
  }

  const areaKm2 = Math.PI * radius * radius;
  const drawnKm2 = polygonAreaKm2(points);
  const drawnProblem = points.length >= 3 ? polygonProblem(points) : null;

  return (
    <div className="flex flex-col gap-3">
      <ol className="grid gap-2 text-xs text-neutral-600 sm:grid-cols-3">
        <li className="rounded-lg bg-neutral-50 p-2">
          <b>{t("zone_editor.step1_title")}</b>
          <br />
          {t("zone_editor.step1_body")}
        </li>
        <li className="rounded-lg bg-neutral-50 p-2">
          <b>{t("zone_editor.step2_title")}</b>
          <br />
          {t("zone_editor.step2_body")}
        </li>
        <li className="rounded-lg bg-neutral-50 p-2">
          <b>{t("zone_editor.step3_title")}</b>
          <br />
          {t("zone_editor.step3_body")}
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
            {t("zone_editor.use_store_address")}
          </button>
          <p className="text-xs text-neutral-400">{t("zone_editor.on_file", { address: storeAddress })}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-neutral-500">Express area:</span>
        {(["circle", "area"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => (m === "area" && points.length < 3 ? startFromCircle() : setMode(m))}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              mode === m ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-300 hover:bg-neutral-50"
            }`}
          >
            {m === "circle" ? "⭕ Circle (km)" : "✏️ Draw custom area"}
          </button>
        ))}
      </div>

      <div className="relative isolate z-0">
        <div ref={containerRef} className="h-80 w-full overflow-hidden rounded-lg border border-neutral-300 md:h-[26rem]" />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          title={t("zone_editor.locate_me")}
          aria-label={t("zone_editor.use_my_current_location")}
          className="absolute bottom-3 end-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 bg-white text-base shadow-md transition hover:bg-neutral-50 disabled:opacity-50"
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
          ) : (
            "🎯"
          )}
        </button>
      </div>

      {mode === "area" && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-sm">
          <p className="font-medium text-violet-900">Draw the area customers get Express delivery in</p>
          <p className="mt-0.5 text-xs text-neutral-600">
            Click the map to add points around the area. Drag a point to move it, double-click a point to remove it. Customers outside the shape can still get
            Standard delivery if it is switched on.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={startFromCircle} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium hover:bg-neutral-50">
              Start from the circle
            </button>
            <button
              type="button"
              onClick={() => setPoints((p) => p.slice(0, -1))}
              disabled={points.length === 0}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-40"
            >
              Undo last point
            </button>
            <button
              type="button"
              onClick={() => setPoints([])}
              disabled={points.length === 0}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-40"
            >
              Clear shape
            </button>
            <span className="text-xs text-neutral-500">
              {points.length} point{points.length === 1 ? "" : "s"}
              {points.length >= 3 && ` · about ${drawnKm2 < 10 ? drawnKm2.toFixed(1) : drawnKm2.toFixed(0)} km²`}
            </span>
          </div>
          {drawnProblem && <p className="mt-2 text-xs font-medium text-red-600">{drawnProblem}</p>}
        </div>
      )}

      <div className={`rounded-lg border border-neutral-200 p-3 ${mode === "area" ? "hidden" : ""}`}>
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
          {t("zone_editor.covers_about", { area: areaKm2.toFixed(0), diameter: (radius * 2).toFixed(1) })}
          {center && t("zone_editor.centre", { lat: center[0].toFixed(4), lng: center[1].toFixed(4) })}
        </p>
      </div>

      {message && <p className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-full bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("common.saving") : t("zone_editor.save_boundary")}
        </button>
        {initialRadiusKm != null && (
          <button
            onClick={clear}
            disabled={pending}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50"
          >
            {t("zone_editor.remove_boundary")}
          </button>
        )}
      </div>
    </div>
  );
}
