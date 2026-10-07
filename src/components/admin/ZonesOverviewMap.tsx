"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_URL, TILE_OPTIONS, marketGeo } from "@/lib/map-config";
import { useMarket } from "@/components/MoneyProvider";
import { polygonAreaKm2, type LatLng } from "@/lib/geo-polygon";

export interface OverviewZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Express circle radius; null when no boundary is set yet (the location is shown as a pin only). */
  radiusKm: number | null;
  color: string;
  polygon?: [number, number][] | null;
  /** FasTrack's own hub or a supplier's shop. */
  kind?: "fastrack" | "supplier";
  orders?: number;
  products?: number;
  /** Saved customer addresses inside the Express area. */
  customers?: number | null;
  standardEnabled?: boolean;
  standardRadiusKm?: number | null;
  standardDays?: number;
  address?: string | null;
  status?: string | null;
}

export interface OverviewPoint {
  lat: number;
  lng: number;
}

const BRAND = "#1d4ed8";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function areaOf(z: OverviewZone): number | null {
  if (z.polygon && z.polygon.length >= 3) return polygonAreaKm2(z.polygon as LatLng[]);
  return z.radiusKm != null ? Math.PI * z.radiusKm * z.radiusKm : null;
}

function popupHtml(z: OverviewZone): string {
  const hub = z.kind === "fastrack";
  const accent = hub ? BRAND : z.color;
  const area = areaOf(z);
  const stat = (icon: string, label: string, value: string) =>
    `<div style="background:#f8fafc;border-radius:12px;padding:8px 10px"><div style="font-size:11px;color:#64748b">${icon} ${label}</div><div style="font-size:15px;font-weight:800;color:#0f172a">${value}</div></div>`;
  return `
  <div style="width:250px;font-family:inherit">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:38px;height:38px;border-radius:12px;background:${hub ? "linear-gradient(135deg,#1d4ed8,#38bdf8)" : "#fff"};border:${hub ? "0" : `3px solid ${accent}`};display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 4px 12px rgba(0,0,0,.18)">${hub ? "🏬" : "🏪"}</div>
      <div style="min-width:0">
        <div style="font-size:14px;font-weight:800;color:#0f172a;line-height:1.2">${esc(z.name)}</div>
        <div style="margin-top:3px"><span style="font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:${hub ? "#dbeafe" : "#fef3c7"};color:${hub ? "#1e40af" : "#92400e"}">${hub ? "FasTrack hub" : "Supplier shop"}</span>${z.status && z.status !== "approved" ? ` <span style="font-size:10px;font-weight:700;color:#b45309">${esc(z.status)}</span>` : ""}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      ${stat("🧾", "Orders", String(z.orders ?? 0))}
      ${stat("📦", "Products", String(z.products ?? 0))}
      ${stat("⚡", "Express area", z.polygon && z.polygon.length >= 3 ? `custom · ${area && area < 10 ? area.toFixed(1) : Math.round(area ?? 0)} km²` : z.radiusKm != null ? `${z.radiusKm} km` : "not set")}
      ${stat("📌", "Customers inside", z.customers == null ? "—" : String(z.customers))}
    </div>
    <div style="margin-top:8px;font-size:12px;color:#475569">${z.standardEnabled === false ? "Standard delivery is off" : `📦 Standard: ${z.standardRadiusKm ? `within ${z.standardRadiusKm} km` : "no distance limit"} · ${z.standardDays ?? 2} day${(z.standardDays ?? 2) === 1 ? "" : "s"}`}</div>
    ${z.address ? `<div style="margin-top:4px;font-size:11px;color:#94a3b8">${esc(z.address)}</div>` : ""}
  </div>`;
}

function markerHtml(z: OverviewZone): { html: string; size: [number, number]; anchor: [number, number] } {
  const hub = z.kind === "fastrack";
  const label = `<div style="position:absolute;left:50%;top:${hub ? 52 : 40}px;transform:translateX(-50%);white-space:nowrap;background:${hub ? BRAND : "#fff"};color:${hub ? "#fff" : "#0f172a"};font-size:11px;font-weight:800;padding:2px 9px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.25);border:${hub ? "0" : `2px solid ${z.color}`}">${esc(z.name)}</div>`;
  if (hub) {
    return {
      html: `<div style="position:relative;width:46px;height:46px">
        <span style="position:absolute;inset:-10px;border-radius:20px;background:rgba(37,99,235,.28);animation:ftpulse 2s ease-out infinite"></span>
        <div style="position:relative;width:46px;height:46px;border-radius:16px;background:linear-gradient(135deg,#1d4ed8,#38bdf8);border:3px solid #fff;box-shadow:0 6px 16px rgba(29,78,216,.55);display:flex;align-items:center;justify-content:center;font-size:23px">🏬</div>
        ${label}</div>`,
      size: [46, 46],
      anchor: [23, 23],
    };
  }
  return {
    html: `<div style="position:relative;width:34px;height:34px">
      <div style="width:34px;height:34px;border-radius:999px;background:#fff;border:4px solid ${z.color};box-shadow:0 4px 12px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font-size:16px">🏪</div>
      ${label}</div>`,
    size: [34, 34],
    anchor: [17, 17],
  };
}

// Coverage map of every FasTrack hub and supplier shop: highlighted markers, their delivery areas, customer pins, and a card
// with the numbers for each. FasTrack's own hubs stand out in brand blue; suppliers each keep their own colour.
export default function ZonesOverviewMap({
  zones,
  customerPoints,
  height = "h-96 md:h-[30rem]",
  fill = false,
}: {
  zones: OverviewZone[];
  customerPoints: OverviewPoint[];
  height?: string;
  /** Fill the parent (which must have a height) instead of using a fixed height. */
  fill?: boolean;
}) {
  const startCenter = marketGeo(useMarket().countryCode).center;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<{ hubs: LayerGroup; suppliers: LayerGroup; areas: LayerGroup; customers: LayerGroup } | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState({ hubs: true, suppliers: true, areas: true, customers: true });

  const hubs = useMemo(() => zones.filter((z) => z.kind === "fastrack"), [zones]);
  const suppliers = useMemo(() => zones.filter((z) => z.kind !== "fastrack"), [zones]);
  const zoned = useMemo(() => zones.filter((z) => z.radiusKm != null || (z.polygon && z.polygon.length >= 3)), [zones]);

  useEffect(() => {
    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: false }).setView(startCenter, 10);
      L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);
      // The map lives in a pop-up that can be maximised, so follow its size.
      if (typeof ResizeObserver !== "undefined") {
        resizeObs = new ResizeObserver(() => map.invalidateSize());
        resizeObs.observe(containerRef.current);
      }

      const layers = {
        areas: L.layerGroup().addTo(map),
        customers: L.layerGroup().addTo(map),
        suppliers: L.layerGroup().addTo(map),
        hubs: L.layerGroup().addTo(map),
      };
      layersRef.current = layers;

      const bounds = L.latLngBounds([]);
      for (const z of zones) {
        const hub = z.kind === "fastrack";
        const color = hub ? BRAND : z.color;
        const hasShape = z.polygon && z.polygon.length >= 3;
        if (hasShape || z.radiusKm != null) {
          const style = hub
            ? { color, fillColor: color, fillOpacity: 0.16, weight: 3 }
            : { color, fillColor: color, fillOpacity: 0.1, weight: 2, dashArray: "7 6" };
          const area = hasShape
            ? L.polygon(z.polygon as LatLng[], style)
            : L.circle([z.lat, z.lng], { radius: (z.radiusKm as number) * 1000, ...style });
          area.addTo(layers.areas);
          area.bindTooltip(`${z.name} · ${hasShape ? "custom area" : `${z.radiusKm} km`}`, { sticky: true });
          bounds.extend(area.getBounds());
        } else {
          bounds.extend([z.lat, z.lng]);
        }
        const mk = markerHtml(z);
        const marker = L.marker([z.lat, z.lng], {
          icon: L.divIcon({ className: "", html: mk.html, iconSize: mk.size, iconAnchor: mk.anchor }),
          zIndexOffset: hub ? 1000 : 500,
        })
          .addTo(hub ? layers.hubs : layers.suppliers)
          .bindPopup(popupHtml(z), { closeButton: true, maxWidth: 280, className: "ft-popup" });
        markersRef.current.set(z.id, marker);
      }
      for (const p of customerPoints) {
        L.circleMarker([p.lat, p.lng], { radius: 3, color: "#fff", weight: 1, fillColor: "#7c3aed", fillOpacity: 0.75 }).addTo(layers.customers);
      }
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Layer switches.
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    (Object.keys(layers) as (keyof typeof layers)[]).forEach((key) => {
      const on = show[key];
      if (on && !map.hasLayer(layers[key])) layers[key].addTo(map);
      if (!on && map.hasLayer(layers[key])) map.removeLayer(layers[key]);
    });
  }, [show, ready]);

  function focus(id: string) {
    const map = mapRef.current;
    const marker = markersRef.current.get(id);
    if (!map || !marker) return;
    const z = zones.find((x) => x.id === id);
    if (z?.kind === "fastrack") setShow((s) => ({ ...s, hubs: true }));
    else setShow((s) => ({ ...s, suppliers: true }));
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 11), { duration: 0.8 });
    setTimeout(() => marker.openPopup(), 850);
  }

  const chip = (on: boolean, accent: string) =>
    `flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm backdrop-blur transition ${
      on ? "border-transparent text-white" : "border-neutral-300 bg-white/90 text-neutral-500"
    }`;

  return (
    <div className={`flex flex-col gap-3 ${fill ? "h-full min-h-0" : ""}`}>
      <style>{`
        @keyframes ftpulse { 0% { transform: scale(.7); opacity: .9 } 100% { transform: scale(1.5); opacity: 0 } }
        .ft-popup .leaflet-popup-content-wrapper { border-radius: 18px; box-shadow: 0 12px 32px rgba(15,23,42,.25); }
        .ft-popup .leaflet-popup-content { margin: 14px; }
      `}</style>

      <div className={`relative isolate z-0 ${fill ? "min-h-[300px] flex-1" : ""}`}>
        {/* Leaflet forces position:relative on its container, so when filling, an absolute wrapper gives it the size. */}
        <div className={fill ? "absolute inset-0" : ""}>
          <div ref={containerRef} className={`w-full overflow-hidden rounded-2xl border border-neutral-200 ${fill ? "h-full" : height}`} />
        </div>

        {/* layer switches */}
        <div className="absolute start-3 top-3 z-[1000] flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setShow((s) => ({ ...s, hubs: !s.hubs }))} className={chip(show.hubs, BRAND)} style={show.hubs ? { background: BRAND } : undefined}>
            🏬 FasTrack hubs <span className="rounded-full bg-white/25 px-1.5">{hubs.length}</span>
          </button>
          <button type="button" onClick={() => setShow((s) => ({ ...s, suppliers: !s.suppliers }))} className={chip(show.suppliers, "#d97706")} style={show.suppliers ? { background: "#d97706" } : undefined}>
            🏪 Suppliers <span className="rounded-full bg-white/25 px-1.5">{suppliers.length}</span>
          </button>
          <button type="button" onClick={() => setShow((s) => ({ ...s, areas: !s.areas }))} className={chip(show.areas, "#0891b2")} style={show.areas ? { background: "#0891b2" } : undefined}>
            ⭕ Delivery areas <span className="rounded-full bg-white/25 px-1.5">{zoned.length}</span>
          </button>
          <button type="button" onClick={() => setShow((s) => ({ ...s, customers: !s.customers }))} className={chip(show.customers, "#7c3aed")} style={show.customers ? { background: "#7c3aed" } : undefined}>
            📌 Customers <span className="rounded-full bg-white/25 px-1.5">{customerPoints.length}</span>
          </button>
        </div>

        {/* legend */}
        <div className="pointer-events-none absolute bottom-3 start-3 z-[1000] rounded-2xl bg-white/92 p-3 text-[11px] shadow-lg backdrop-blur">
          <p className="mb-1.5 font-extrabold uppercase tracking-wider text-neutral-400">Legend</p>
          <div className="flex items-center gap-2 text-neutral-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] text-white" style={{ background: "linear-gradient(135deg,#1d4ed8,#38bdf8)" }}>🏬</span>
            FasTrack hub · solid blue area
          </div>
          <div className="mt-1 flex items-center gap-2 text-neutral-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-amber-500 bg-white text-[10px]">🏪</span>
            Supplier shop · dashed coloured area
          </div>
          <div className="mt-1 flex items-center gap-2 text-neutral-700">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> Customer address
          </div>
        </div>
      </div>

      {/* clickable list: tap a location to fly to it and open its card */}
      {zones.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[...zones]
            .sort((a, b) => Number(b.kind === "fastrack") - Number(a.kind === "fastrack"))
            .map((z) => {
              const hub = z.kind === "fastrack";
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => focus(z.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-start transition hover:shadow-md ${
                    hub ? "border-blue-200 bg-blue-50" : "border-neutral-200 bg-white"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl text-base ${hub ? "text-white" : "border-[3px] bg-white"}`}
                    style={hub ? { background: "linear-gradient(135deg,#1d4ed8,#38bdf8)" } : { borderColor: z.color }}
                  >
                    {hub ? "🏬" : "🏪"}
                  </span>
                  <span className="min-w-0">
                    <span className="block max-w-[11rem] truncate text-xs font-extrabold text-neutral-900">{z.name}</span>
                    <span className="block text-[11px] text-neutral-500">
                      {hub ? "FasTrack hub" : "Supplier"} ·{" "}
                      {z.polygon && z.polygon.length >= 3 ? "custom area" : z.radiusKm != null ? `${z.radiusKm} km` : "no area yet"}
                    </span>
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
