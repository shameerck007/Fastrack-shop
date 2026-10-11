"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LayerGroup, Map as LeafletMap, Polygon, Circle } from "leaflet";
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
  standardEnabled: boolean;
  standardDays: number;
  priority: number;
  shops: number;
  orders: number;
}

export interface CoverageShop extends AreaShopRow {
  areaId: string | null;
  orders: number;
  products: number;
}

const BRAND = "#1d4ed8";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function shopIcon(shop: CoverageShop, color: string, selected: boolean): { html: string; size: number } {
  const hub = shop.kind === "fastrack";
  const size = hub ? 38 : 30;
  const ring = selected ? "#0f172a" : hub ? BRAND : color;
  const inner = hub ? `<img src="/icon-192.png" alt="" style="width:100%;height:100%;object-fit:cover"/>` : `<span style="font-size:13px">🏪</span>`;
  return {
    html: `<div style="width:${size}px;height:${size}px;border-radius:${hub ? 12 : 999}px;background:#fff;border:${selected ? 4 : 3}px solid ${ring};box-shadow:0 4px 12px rgba(15,23,42,.3);display:flex;align-items:center;justify-content:center;overflow:hidden;${selected ? "transform:scale(1.15)" : ""}">${inner}</div>`,
    size,
  };
}

const chip = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold";

export default function CoverageExplorer({ zones, shops }: { zones: CoverageZone[]; shops: CoverageShop[] }) {
  const router = useRouter();
  const startCenter = marketGeo(useMarket().countryCode).center;
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const layers = useRef<{ zones: LayerGroup; shops: LayerGroup } | null>(null);
  const zoneShapes = useRef<Map<string, Polygon | Circle>>(new Map());
  const fitted = useRef(false);

  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [tab, setTab] = useState<"zones" | "shops">("zones");
  const [q, setQ] = useState("");
  const [show, setShow] = useState({ zones: true, shops: true });
  const [pin, setPin] = useState<CoverageShop | null>(null);
  const [rule, setRule] = useState<CoverageShop | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const colorOf = useMemo(() => new Map(zones.map((z) => [z.id, z.color])), [zones]);
  const live = shops.filter((s) => s.lat != null && s.lng != null).length;
  const unzoned = shops.filter((s) => s.lat != null && !s.areaId).length;
  const sel = zones.find((z) => z.id === selected) ?? null;
  const needle = q.trim().toLowerCase();

  // ---- map (created once)
  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: true }).setView(startCenter, 10);
      L.tileLayer(TILE_URL, { ...TILE_OPTIONS, attribution: "" }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
      layers.current = { zones: L.layerGroup().addTo(map), shops: L.layerGroup().addTo(map) };
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
    const shapes = zoneShapes.current;
    return () => {
      cancelled = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      shapes.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- zone shapes; the picked zone is emphasised, the rest fade
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
      const style = { color: z.color, fillColor: z.color, fillOpacity: isSel ? 0.28 : dim ? 0.04 : 0.14, weight: isSel ? 3.5 : dim ? 1.5 : 2.5, opacity: dim ? 0.45 : 1 };
      const hasShape = z.polygon && z.polygon.length >= 3;
      const shape = hasShape ? L.polygon(z.polygon as LatLng[], style) : z.lat != null && z.lng != null && z.radiusKm != null ? L.circle([z.lat, z.lng], { radius: z.radiusKm * 1000, ...style }) : null;
      if (!shape) continue;
      shape.addTo(g.zones);
      shape.bindTooltip(`<b>${esc(z.name)}</b><br/>${z.expressEnabled ? "Express" : "Express off"} · ${z.standardEnabled ? `Standard ${z.standardDays} d` : "Standard off"}`, { sticky: true });
      shape.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelected(z.id);
        setSelectedShop(null);
      });
      zoneShapes.current.set(z.id, shape);
      bounds.extend(shape.getBounds());
    }
    // First view: fit the zones (shops far outside them stay reachable from the list), or the shops when there are no shapes yet.
    if (!fitted.current) {
      if (!bounds.isValid()) for (const s of shops) if (s.lat != null && s.lng != null) bounds.extend([s.lat, s.lng]);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      fitted.current = true;
    }
  }, [ready, zones, selected, shops]);

  // ---- shop markers
  useEffect(() => {
    const L = leafletRef.current;
    const g = layers.current;
    if (!ready || !L || !g) return;
    g.shops.clearLayers();
    for (const s of shops) {
      if (s.lat == null || s.lng == null) continue;
      const color = (s.areaId && colorOf.get(s.areaId)) || "#64748b";
      const dim = selected != null && s.areaId !== selected;
      const ic = shopIcon(s, color, selectedShop === s.id);
      const marker = L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: "", html: ic.html, iconSize: [ic.size, ic.size], iconAnchor: [ic.size / 2, ic.size / 2] }),
        zIndexOffset: (s.kind === "fastrack" ? 1000 : 500) + (selectedShop === s.id ? 2000 : 0),
        opacity: dim ? 0.5 : 1,
      }).addTo(g.shops);
      marker.bindTooltip(`<b>${esc(s.name)}</b><br/>${esc(s.areaName ?? "Outside every zone")} · ${esc(shopStatus(s).label)}`, { direction: "top", offset: [0, -10] });
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedShop(s.id);
        setTab("shops");
      });
    }
  }, [ready, shops, selected, selectedShop, colorOf]);

  // ---- layer switches
  useEffect(() => {
    const map = mapRef.current;
    const g = layers.current;
    if (!ready || !map || !g) return;
    (Object.keys(g) as (keyof typeof g)[]).forEach((k) => {
      if (show[k] && !map.hasLayer(g[k])) g[k].addTo(map);
      if (!show[k] && map.hasLayer(g[k])) map.removeLayer(g[k]);
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
      if (shape && mapRef.current) mapRef.current.flyToBounds(shape.getBounds(), { padding: [50, 50], duration: 0.7 });
    }
  }
  function pickShop(s: CoverageShop) {
    setSelectedShop(s.id);
    if (s.lat != null && s.lng != null) mapRef.current?.flyTo([s.lat, s.lng], Math.max(mapRef.current.getZoom(), 12), { duration: 0.7 });
  }

  const visibleShops = shops.filter((s) => (!selected || s.areaId === selected) && (!needle || [s.name, s.address, s.areaName].some((f) => f?.toLowerCase().includes(needle))));
  const visibleZones = zones.filter((z) => !needle || z.name.toLowerCase().includes(needle));

  const layerBtn = (key: keyof typeof show, label: string) => (
    <button
      type="button"
      onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
      className={`h-8 rounded-full px-3 text-xs font-bold transition ${show[key] ? "bg-blue-700 text-white" : "bg-white text-neutral-500 ring-1 ring-neutral-200 hover:bg-neutral-50"}`}
    >
      {label}
    </button>
  );

  return (
    <div ref={wrapRef} className={`flex flex-col gap-3 bg-neutral-50 ${fullscreen ? "h-screen p-3" : ""}`}>
      {/* toolbar: what you are looking at, and what the map shows */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-neutral-600">
          <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-neutral-200">
            🗺️ {zones.length} {zones.length === 1 ? "zone" : "zones"}
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-neutral-200">
            🏪 {live}/{shops.length} shops live
          </span>
          {unzoned > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800 ring-1 ring-amber-200">
              ⚠️ {unzoned} {unzoned === 1 ? "shop" : "shops"} outside every zone
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {layerBtn("zones", "Zones")}
          {layerBtn("shops", "🏪 Shops")}
          <button type="button" onClick={toggleFullscreen} aria-label="Full screen" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm ring-1 ring-neutral-200 hover:bg-neutral-50">
            {fullscreen ? "🗗" : "⛶"}
          </button>
        </div>
      </div>

      <div className={`grid gap-3 lg:grid-cols-[19rem_minmax(0,1fr)] ${fullscreen ? "min-h-0 flex-1" : "lg:h-[calc(100dvh-12.5rem)] lg:min-h-[30rem]"}`}>
        {/* list */}
        <aside className="order-2 flex max-h-[60vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white lg:order-1 lg:max-h-none">
          <div className="shrink-0 space-y-2 border-b border-neutral-100 p-2.5">
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
              placeholder={tab === "zones" ? "Search zones…" : "Search shops…"}
              className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "zones" && !sel && (
              <ul className="divide-y divide-neutral-100">
                {visibleZones.length === 0 && <li className="p-6 text-center text-sm text-neutral-400">No zones match.</li>}
                {visibleZones.map((z) => (
                  <li key={z.id}>
                    <button type="button" onClick={() => pickZone(z.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-start transition hover:bg-neutral-50">
                      <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: z.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-neutral-900">{z.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1">
                          <span className={`${chip} ${z.expressEnabled ? "bg-blue-50 text-blue-800" : "bg-neutral-100 text-neutral-500"}`}>{z.expressEnabled ? "Express" : "Express off"}</span>
                          <span className={`${chip} ${z.standardEnabled ? "bg-blue-50 text-blue-800" : "bg-neutral-100 text-neutral-500"}`}>{z.standardEnabled ? `Standard ${z.standardDays}d` : "Standard off"}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-end text-[11px] leading-tight text-neutral-500">
                        <b className="block text-sm text-neutral-900">{z.shops}</b>
                        {z.shops === 1 ? "shop" : "shops"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {tab === "zones" && sel && (
              <div className="flex flex-col">
                <button type="button" onClick={() => pickZone(null)} className="px-3 py-2 text-start text-xs font-bold text-blue-700 hover:underline">
                  ← All zones
                </button>
                <div className="mx-3 rounded-xl px-3 py-2.5 text-white" style={{ background: sel.color }}>
                  <p className="text-base font-extrabold leading-tight">{sel.name}</p>
                  <p className="text-[11px] opacity-90">
                    {sel.polygon ? `Drawn zone, ${sel.polygon.length} points` : `Circle, ${sel.radiusKm} km radius`}
                    {sel.priority !== 0 ? ` · priority ${sel.priority}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
                  <span className={`${chip} ${sel.expressEnabled ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-500"}`}>{sel.expressEnabled ? "⚡ Express in this zone" : "Express off"}</span>
                  <span className={`${chip} ${sel.standardEnabled ? "bg-blue-50 text-blue-800" : "bg-neutral-100 text-neutral-500"}`}>{sel.standardEnabled ? `📦 Standard ${sel.standardDays} ${sel.standardDays === 1 ? "day" : "days"}` : "Standard off"}</span>
                </div>
                <div className="mx-3 mt-2.5 grid grid-cols-2 divide-x divide-neutral-100 rounded-xl border border-neutral-100 text-center">
                  <div className="py-2">
                    <p className="text-lg font-extrabold leading-tight text-neutral-900">{sel.shops}</p>
                    <p className="text-[11px] text-neutral-500">shops inside</p>
                  </div>
                  <div className="py-2">
                    <p className="text-lg font-extrabold leading-tight text-neutral-900">{sel.orders}</p>
                    <p className="text-[11px] text-neutral-500">orders</p>
                  </div>
                </div>
                <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Shops in this zone</p>
                {visibleShops.length === 0 ? (
                  <p className="px-3 pb-4 text-sm text-neutral-400">No shop pinned inside this zone yet.</p>
                ) : (
                  <ShopList shops={visibleShops} selectedShop={selectedShop} onPick={pickShop} onPin={setPin} onRule={setRule} colorOf={colorOf} />
                )}
              </div>
            )}

            {tab === "shops" && (
              <div className="flex flex-col">
                {selected && (
                  <button type="button" onClick={() => pickZone(null)} className="m-2 self-start rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600 hover:bg-neutral-200">
                    Zone: {sel?.name} ✕
                  </button>
                )}
                {visibleShops.length === 0 ? (
                  <p className="p-6 text-center text-sm text-neutral-400">No shops match.</p>
                ) : (
                  <ShopList shops={visibleShops} selectedShop={selectedShop} onPick={pickShop} onPin={setPin} onRule={setRule} colorOf={colorOf} />
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-neutral-100 p-2.5">
            <Link href="/admin/zones" className="flex h-9 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white hover:bg-blue-800">
              Manage zones
            </Link>
          </div>
        </aside>

        {/* map */}
        <div className="relative order-1 h-[52vh] min-w-0 overflow-hidden rounded-2xl border border-neutral-200 lg:order-2 lg:h-full">
          <style>{`.leaflet-tooltip { border-radius: 10px; border: 0; box-shadow: 0 6px 20px rgba(15,23,42,.2); padding: 6px 9px; font-size: 12px; }`}</style>
          <div ref={containerRef} className="h-full w-full" />
          <div className="pointer-events-none absolute bottom-2 start-2 z-[1000] hidden rounded-xl bg-white/90 px-2.5 py-1.5 text-[10px] text-neutral-600 shadow backdrop-blur sm:block">
            <span className="me-3 inline-flex items-center gap-1">
              <span className="h-2.5 w-4 rounded-sm border-2 border-blue-600 bg-blue-100" /> Zone
            </span>
          </div>
        </div>
      </div>

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
    <ul className="divide-y divide-neutral-100">
      {shops.map((s) => {
        const st = shopStatus(s);
        const color = (s.areaId && colorOf.get(s.areaId)) || "#94a3b8";
        const active = selectedShop === s.id;
        return (
          <li key={s.id} className={active ? "bg-blue-50/60" : ""}>
            <button type="button" onClick={() => onPick(s)} className="flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-neutral-50">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-white text-sm" style={{ borderColor: s.kind === "fastrack" ? BRAND : color }}>
                {s.kind === "fastrack" ? <img src="/icon-192.png" alt="" className="h-full w-full object-cover" /> : "🏪"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-neutral-900">{s.name}</span>
                <span className="block truncate text-[11px] text-neutral-500">{s.areaName ?? (s.lat != null ? "Outside every zone" : "No GPS pin")}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.tone}`}>{s.lat == null ? "No pin" : s.expressOn ? "Express" : s.standardOn ? "Standard" : "Off"}</span>
            </button>
            {active && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2.5 text-[11px] text-neutral-500">
                <span>
                  {st.label} · 🧾 {s.orders} · 📦 {s.products}
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
            )}
          </li>
        );
      })}
    </ul>
  );
}
