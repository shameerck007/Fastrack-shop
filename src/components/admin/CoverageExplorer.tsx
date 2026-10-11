"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LayerGroup, Map as LeafletMap, Marker, Polygon, Circle } from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "@/components/Link";
import { TILE_URL, TILE_OPTIONS, marketGeo } from "@/lib/map-config";
import { useMarket } from "@/components/MoneyProvider";
import { PinModal, RuleModal, shopStatus, type AreaShopRow } from "@/components/admin/AreaShops";
import type { LatLng } from "@/lib/geo-polygon";

export interface CoverageZone {
  id: string;
  name: string;
  color: string;
  polygon: LatLng[] | null;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
  expressEnabled: boolean;
  expressMaxKm: number;
  standardEnabled: boolean;
  standardDays: number;
  priority: number;
  shops: number;
  customers: number;
  orders: number;
  products: number;
}

export interface CoverageShop extends AreaShopRow {
  areaId: string | null;
  orders: number;
  products: number;
}

export interface CoveragePoint {
  lat: number;
  lng: number;
  outside: boolean;
}

const BRAND = "#1d4ed8";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function shopIcon(shop: CoverageShop, color: string, selected: boolean): { html: string; size: [number, number] } {
  const hub = shop.kind === "fastrack";
  const size = hub ? 44 : 34;
  const ring = selected ? "#0f172a" : hub ? BRAND : color;
  const inner = hub
    ? `<img src="/icon-192.png" alt="" style="width:100%;height:100%;object-fit:cover"/>`
    : `<span style="font-size:15px">🏪</span>`;
  const pulse = hub ? `<span style="position:absolute;inset:-9px;border-radius:18px;background:rgba(37,99,235,.25);animation:ftpulse 2s ease-out infinite"></span>` : "";
  return {
    html: `<div style="position:relative;width:${size}px;height:${size}px">${pulse}<div style="position:relative;width:${size}px;height:${size}px;border-radius:${hub ? 15 : 999}px;background:#fff;border:${selected ? 4 : 3}px solid ${ring};box-shadow:0 6px 16px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;overflow:hidden;transition:transform .15s;${selected ? "transform:scale(1.15)" : ""}">${inner}</div></div>`,
    size: [size, size],
  };
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blue" | "green" | "amber" | "red" }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-600",
    blue: "bg-blue-50 text-blue-800",
    green: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-3">
      <p className="text-[11px] font-medium text-neutral-500">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-xl font-extrabold leading-tight text-neutral-900">{value}</p>
    </div>
  );
}

export default function CoverageExplorer({ zones, shops, points }: { zones: CoverageZone[]; shops: CoverageShop[]; points: CoveragePoint[] }) {
  const router = useRouter();
  const startCenter = marketGeo(useMarket().countryCode).center;
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const layers = useRef<{ zones: LayerGroup; reach: LayerGroup; shops: LayerGroup; customers: LayerGroup } | null>(null);
  const zoneShapes = useRef<Map<string, Polygon | Circle>>(new Map());
  const shopMarkers = useRef<Map<string, Marker>>(new Map());
  const fitted = useRef(false);

  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [tab, setTab] = useState<"zones" | "shops">("zones");
  const [q, setQ] = useState("");
  const [show, setShow] = useState({ zones: true, reach: true, shops: true, customers: true });
  const [pin, setPin] = useState<CoverageShop | null>(null);
  const [rule, setRule] = useState<CoverageShop | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const colorOf = useMemo(() => new Map(zones.map((z) => [z.id, z.color])), [zones]);
  const zoneName = useMemo(() => new Map(zones.map((z) => [z.id, z.name])), [zones]);
  const outside = points.filter((p) => p.outside).length;
  const live = shops.filter((s) => s.lat != null && s.lng != null).length;
  const sel = zones.find((z) => z.id === selected) ?? null;
  const needle = q.trim().toLowerCase();

  // ---- map setup (once)
  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: true }).setView(startCenter, 10);
      L.tileLayer(TILE_URL, { ...TILE_OPTIONS, attribution: "" }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);
      layers.current = {
        zones: L.layerGroup().addTo(map),
        reach: L.layerGroup().addTo(map),
        customers: L.layerGroup().addTo(map),
        shops: L.layerGroup().addTo(map),
      };
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => map.invalidateSize());
        ro.observe(containerRef.current);
      }
      map.on("click", () => {
        setSelected(null);
        setSelectedShop(null);
      });
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      zoneShapes.current.clear();
      shopMarkers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- zones (shapes), restyled when one is selected
  useEffect(() => {
    const L = leafletRef.current;
    const g = layers.current;
    const map = mapRef.current;
    if (!ready || !L || !g || !map) return;
    g.zones.clearLayers();
    zoneShapes.current.clear();
    const bounds = L.latLngBounds([]);
    for (const z of zones) {
      const isSel = selected === z.id;
      const dim = selected != null && !isSel;
      const style = { color: z.color, fillColor: z.color, fillOpacity: isSel ? 0.3 : dim ? 0.05 : 0.16, weight: isSel ? 4 : dim ? 1.5 : 2.5, opacity: dim ? 0.5 : 1 };
      const hasShape = z.polygon && z.polygon.length >= 3;
      const shape = hasShape ? L.polygon(z.polygon as LatLng[], style) : z.lat != null && z.lng != null && z.radiusKm != null ? L.circle([z.lat, z.lng], { radius: z.radiusKm * 1000, ...style }) : null;
      if (!shape) continue;
      shape.addTo(g.zones);
      shape.bindTooltip(`<b>${esc(z.name)}</b><br/>${z.expressEnabled ? `Express ≤ ${z.expressMaxKm} km` : "Express off"} · ${z.standardEnabled ? `Standard ${z.standardDays} d` : "Standard off"}`, { sticky: true });
      shape.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelected(z.id);
        setSelectedShop(null);
      });
      zoneShapes.current.set(z.id, shape);
      bounds.extend(shape.getBounds());
    }
    if (!fitted.current) {
      for (const s of shops) if (s.lat != null && s.lng != null) bounds.extend([s.lat, s.lng]);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60] });
      fitted.current = true;
    }
  }, [ready, zones, selected, shops]);

  // ---- express reach circles + shop markers
  useEffect(() => {
    const L = leafletRef.current;
    const g = layers.current;
    if (!ready || !L || !g) return;
    g.reach.clearLayers();
    g.shops.clearLayers();
    shopMarkers.current.clear();
    for (const s of shops) {
      if (s.lat == null || s.lng == null) continue;
      const color = (s.areaId && colorOf.get(s.areaId)) || "#64748b";
      const dim = selected != null && s.areaId !== selected;
      if (s.expressOn && s.expressReachKm) {
        L.circle([s.lat, s.lng], { radius: s.expressReachKm * 1000, color, weight: 1.5, dashArray: "5 5", fillColor: color, fillOpacity: dim ? 0.01 : 0.06, opacity: dim ? 0.25 : 0.9, interactive: false }).addTo(g.reach);
      }
      const ic = shopIcon(s, color, selectedShop === s.id);
      const marker = L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: "", html: ic.html, iconSize: ic.size, iconAnchor: [ic.size[0] / 2, ic.size[1] / 2] }),
        zIndexOffset: (s.kind === "fastrack" ? 1000 : 500) + (selectedShop === s.id ? 2000 : 0),
        opacity: dim ? 0.45 : 1,
      }).addTo(g.shops);
      marker.bindTooltip(`<b>${esc(s.name)}</b><br/>${esc(s.areaName ?? "Outside every area")} · ${esc(shopStatus(s).label)}`, { direction: "top", offset: [0, -12] });
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedShop(s.id);
        setTab("shops");
      });
      shopMarkers.current.set(s.id, marker);
    }
  }, [ready, shops, selected, selectedShop, colorOf]);

  // ---- customer dots
  useEffect(() => {
    const L = leafletRef.current;
    const g = layers.current;
    if (!ready || !L || !g) return;
    g.customers.clearLayers();
    for (const p of points) {
      L.circleMarker([p.lat, p.lng], { radius: p.outside ? 4.5 : 3, color: "#fff", weight: 1, fillColor: p.outside ? "#dc2626" : "#7c3aed", fillOpacity: 0.85 }).addTo(g.customers);
    }
  }, [ready, points]);

  // ---- layer switches
  useEffect(() => {
    const map = mapRef.current;
    const g = layers.current;
    if (!ready || !map || !g) return;
    (Object.keys(g) as (keyof typeof g)[]).forEach((k) => {
      const on = show[k];
      if (on && !map.hasLayer(g[k])) g[k].addTo(map);
      if (!on && map.hasLayer(g[k])) map.removeLayer(g[k]);
    });
  }, [show, ready]);

  // ---- fullscreen
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.();
  }

  function pickZone(id: string | null) {
    setSelected(id);
    setSelectedShop(null);
    if (id) {
      const shape = zoneShapes.current.get(id);
      if (shape && mapRef.current) mapRef.current.flyToBounds(shape.getBounds(), { padding: [70, 70], duration: 0.8 });
    }
  }
  function pickShop(s: CoverageShop) {
    setSelectedShop(s.id);
    if (s.lat != null && s.lng != null) mapRef.current?.flyTo([s.lat, s.lng], Math.max(mapRef.current.getZoom(), 12), { duration: 0.8 });
  }

  const visibleShops = shops.filter((s) => (!selected || s.areaId === selected) && (!needle || [s.name, s.address, s.areaName].some((f) => f?.toLowerCase().includes(needle))));
  const visibleZones = zones.filter((z) => !needle || z.name.toLowerCase().includes(needle));

  const toggle = (key: keyof typeof show, label: string, color: string) => (
    <button
      type="button"
      onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur transition ${show[key] ? "text-white" : "bg-white/90 text-neutral-500 ring-1 ring-neutral-200"}`}
      style={show[key] ? { background: color } : undefined}
    >
      {label}
    </button>
  );

  return (
    <div ref={wrapRef} className={`relative isolate flex flex-col gap-3 bg-neutral-50 lg:flex-row-reverse ${fullscreen ? "h-screen p-3" : "lg:h-[calc(100dvh-8.25rem)] lg:min-h-[32rem]"}`}>
      <style>{`
        @keyframes ftpulse { 0% { transform: scale(.7); opacity: .9 } 100% { transform: scale(1.5); opacity: 0 } }
        .leaflet-tooltip { border-radius: 12px; border: 0; box-shadow: 0 8px 24px rgba(15,23,42,.22); padding: 8px 10px; font-size: 12px; }
      `}</style>

      {/* map */}
      <div className="relative h-[58vh] min-w-0 overflow-hidden rounded-2xl border border-neutral-200 shadow-sm lg:h-full lg:flex-1">
        <div ref={containerRef} className="h-full w-full" />

        {/* top strip: headline numbers */}
        <div className="pointer-events-none absolute end-3 top-3 z-[1000] flex flex-col items-end gap-2 lg:start-3 lg:end-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="pointer-events-auto flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-extrabold text-neutral-800 shadow-md backdrop-blur">🗺️ {zones.length} {zones.length === 1 ? "zone" : "zones"}</span>
            <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-extrabold text-neutral-800 shadow-md backdrop-blur">🏪 {live}/{shops.length} shops live</span>
            <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold shadow-md backdrop-blur ${outside > 0 ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
              {outside > 0 ? `⚠️ ${outside} addresses outside` : "✓ All addresses covered"}
            </span>
          </div>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
            {toggle("zones", "Zones", "#0891b2")}
            {toggle("reach", "⚡ Express reach", "#0f766e")}
            {toggle("shops", "🏪 Shops", "#d97706")}
            {toggle("customers", "📌 Customers", "#7c3aed")}
            <button type="button" onClick={toggleFullscreen} aria-label="Full screen" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sm shadow-md ring-1 ring-neutral-200 backdrop-blur hover:bg-blue-50">
              {fullscreen ? "🗗" : "⛶"}
            </button>
          </div>
        </div>

        {/* legend */}
        <div className="pointer-events-none absolute bottom-3 end-14 z-[1000] hidden rounded-2xl bg-white/90 p-3 text-[11px] shadow-lg backdrop-blur md:block">
          <div className="flex items-center gap-2 text-neutral-700">
            <span className="h-3 w-5 rounded-sm border-2 border-blue-600 bg-blue-100" /> Zone (Standard)
          </div>
          <div className="mt-1 flex items-center gap-2 text-neutral-700">
            <span className="h-3 w-5 rounded-full border-2 border-dashed border-teal-700" /> Express reach of a shop
          </div>
          <div className="mt-1 flex items-center gap-2 text-neutral-700">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> Customer · <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> outside every zone
          </div>
        </div>
      </div>

      {/* side panel */}
      <aside className="flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm lg:h-full lg:max-h-none lg:w-80 lg:shrink-0">
        <div className="shrink-0 border-b border-neutral-100 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Zones, shops and customers</p>
            <Link href="/admin/zones" className="rounded-full bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800">
              Manage zones
            </Link>
          </div>
          <div className="flex rounded-full bg-neutral-100 p-0.5 text-xs font-bold">
            {(["zones", "shops"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTab(k);
                  if (k === "zones") setSelectedShop(null);
                }}
                className={`h-8 flex-1 rounded-full ${tab === k ? "bg-blue-700 text-white shadow" : "text-neutral-500"}`}
              >
                {k === "zones" ? `Zones (${zones.length})` : `Shops (${shops.length})`}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "zones" ? "🔍 Search zones…" : "🔍 Search shops…"}
            className="mt-2 h-9 w-full rounded-full border border-neutral-200 bg-neutral-50 px-3.5 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === "zones" && !sel && (
            <ul className="flex flex-col gap-2">
              {visibleZones.length === 0 && <li className="p-6 text-center text-sm text-neutral-400">No zones match.</li>}
              {visibleZones.map((z) => (
                <li key={z.id}>
                  <button type="button" onClick={() => pickZone(z.id)} className="group w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <span className="block h-1.5" style={{ background: z.color }} />
                    <span className="block p-3">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-extrabold text-neutral-900">{z.name}</span>
                        <span aria-hidden className="text-neutral-300 transition group-hover:text-blue-600">›</span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <Pill tone={z.expressEnabled ? "blue" : "neutral"}>{z.expressEnabled ? `Express ≤ ${z.expressMaxKm} km` : "Express off"}</Pill>
                        <Pill tone={z.standardEnabled ? "blue" : "neutral"}>{z.standardEnabled ? `Standard ${z.standardDays} d` : "Standard off"}</Pill>
                      </span>
                      <span className="mt-2 grid grid-cols-3 gap-1 text-center">
                        {[
                          ["🏪", z.shops, "shops"],
                          ["📌", z.customers, "addresses"],
                          ["🧾", z.orders, "orders"],
                        ].map(([icon, n, label]) => (
                          <span key={String(label)} className="rounded-xl bg-neutral-50 py-1.5">
                            <span className="block text-sm font-extrabold text-neutral-900">{n}</span>
                            <span className="block text-[10px] text-neutral-500">
                              {icon} {label}
                            </span>
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {outside > 0 && (
                <li className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs text-red-800">
                  <b>{outside} saved addresses</b> are outside every zone and cannot order yet. Extend a zone over the red dots, or add a new zone.
                </li>
              )}
            </ul>
          )}

          {tab === "zones" && sel && (
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => pickZone(null)} className="self-start text-xs font-bold text-blue-700 hover:underline">
                ← All zones
              </button>
              <div className="rounded-2xl p-3 text-white shadow-md" style={{ background: sel.color }}>
                <p className="text-lg font-extrabold leading-tight">{sel.name}</p>
                <p className="mt-0.5 text-xs opacity-90">
                  {sel.polygon ? `Drawn zone, ${sel.polygon.length} points` : `Circle, ${sel.radiusKm} km radius`}
                  {sel.priority !== 0 ? ` · priority ${sel.priority}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Pill tone={sel.expressEnabled ? "green" : "neutral"}>{sel.expressEnabled ? `⚡ Express up to ${sel.expressMaxKm} km` : "Express off"}</Pill>
                <Pill tone={sel.standardEnabled ? "blue" : "neutral"}>{sel.standardEnabled ? `📦 Standard in ${sel.standardDays} ${sel.standardDays === 1 ? "day" : "days"}` : "Standard off"}</Pill>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Metric icon="🏪" label="Shops inside" value={sel.shops} />
                <Metric icon="📌" label="Saved addresses" value={sel.customers} />
                <Metric icon="🧾" label="Orders" value={sel.orders} />
                <Metric icon="📦" label="Products" value={sel.products} />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Shops in this zone</p>
              {visibleShops.length === 0 ? <p className="rounded-2xl bg-neutral-50 p-4 text-center text-sm text-neutral-400">No shop pinned inside this zone yet.</p> : <ShopList shops={visibleShops} selectedShop={selectedShop} onPick={pickShop} onPin={setPin} onRule={setRule} colorOf={colorOf} />}
            </div>
          )}

          {tab === "shops" && (
            <div className="flex flex-col gap-2">
              {selected && (
                <button type="button" onClick={() => pickZone(null)} className="self-start rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600 hover:bg-neutral-200">
                  Zone: {zoneName.get(selected)} ✕
                </button>
              )}
              {visibleShops.length === 0 ? <p className="p-6 text-center text-sm text-neutral-400">No shops match.</p> : <ShopList shops={visibleShops} selectedShop={selectedShop} onPick={pickShop} onPin={setPin} onRule={setRule} colorOf={colorOf} />}
            </div>
          )}
        </div>
      </aside>

      {pin && (
        <PinModal
          row={pin}
          onClose={() => setPin(null)}
          onSaved={() => {
            setPin(null);
            router.refresh();
          }}
        />
      )}
      {rule && (
        <RuleModal
          row={rule}
          onClose={() => setRule(null)}
          onSaved={() => {
            setRule(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ShopList({
  shops,
  selectedShop,
  onPick,
  onPin,
  onRule,
  colorOf,
}: {
  shops: CoverageShop[];
  selectedShop: string | null;
  onPick: (s: CoverageShop) => void;
  onPin: (s: CoverageShop) => void;
  onRule: (s: CoverageShop) => void;
  colorOf: Map<string, string>;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {shops.map((s) => {
        const st = shopStatus(s);
        const color = (s.areaId && colorOf.get(s.areaId)) || "#94a3b8";
        const active = selectedShop === s.id;
        return (
          <li key={s.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${active ? "border-blue-500 ring-2 ring-blue-500/20" : "border-neutral-200"}`}>
            <button type="button" onClick={() => onPick(s)} className="flex w-full items-start gap-3 p-3 text-start">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border-[3px] bg-white text-base" style={{ borderColor: s.kind === "fastrack" ? BRAND : color }}>
                {s.kind === "fastrack" ? <img src="/icon-192.png" alt="" className="h-full w-full object-cover" /> : "🏪"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold text-neutral-900">{s.name}</span>
                <span className="block truncate text-[11px] text-neutral-500">
                  {s.areaName ?? (s.lat != null ? "Outside every zone" : "No GPS pin yet")}
                  {s.address ? ` · ${s.address}` : ""}
                </span>
                <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.tone}`}>{st.label}</span>
              </span>
            </button>
            <div className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50 px-3 py-1.5 text-[11px] text-neutral-500">
              <span>
                🧾 {s.orders} · 📦 {s.products}
                {s.expressMode === "off" ? " · Express off" : s.expressMaxKm != null ? ` · limit ${s.expressMaxKm} km` : ""}
              </span>
              <span className="flex gap-1.5">
                <button type="button" onClick={() => onPin(s)} className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 font-bold text-neutral-700 hover:bg-blue-50">
                  {s.lat != null ? "Move pin" : "Set pin"}
                </button>
                <button type="button" onClick={() => onRule(s)} className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 font-bold text-neutral-700 hover:bg-blue-50">
                  Express rule
                </button>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
