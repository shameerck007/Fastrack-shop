"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_URL, TILE_OPTIONS } from "@/lib/map-config";

interface Point {
  lat: number;
  lng: number;
}

function pin(emoji: string, tone: "blue" | "white", pulse = false) {
  const bg = tone === "blue" ? "background:#1d4ed8;color:#fff" : "background:#fff;color:#111";
  return (
    `<div style="position:relative;width:40px;height:40px">` +
    (pulse ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:rgba(37,99,235,.25);animation:ping 1.6s cubic-bezier(0,0,.2,1) infinite"></span>` : "") +
    `<div style="position:relative;width:40px;height:40px;border-radius:9999px;${bg};display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,.25);border:3px solid #fff">${emoji}</div>` +
    `</div>`
  );
}

/** The rider's task map: pickup shop, drop-off address and the rider's own live position,
 * with a dotted line to whichever stop is next. */
export default function RiderTaskMap({
  shop,
  dest,
  stage,
}: {
  shop: Point | null;
  dest: Point | null;
  /** "pickup" = heading to the shop, "dropoff" = heading to the customer. */
  stage: "pickup" | "dropoff";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const meMarker = useRef<Marker | null>(null);
  const line = useRef<Polyline | null>(null);
  const fitted = useRef(false);
  const [me, setMe] = useState<Point | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !(shop || dest)) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const c = dest ?? shop!;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView([c.lat, c.lng], 14);
      L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
      L.control.attribution({ prefix: false, position: "bottomleft" }).addTo(map);
      const icon = (html: string) => L.divIcon({ html, className: "", iconSize: [40, 40], iconAnchor: [20, 20] });
      if (shop) L.marker([shop.lat, shop.lng], { icon: icon(pin("🏪", "white")) }).addTo(map);
      if (dest) L.marker([dest.lat, dest.lng], { icon: icon(pin("🏠", "blue")) }).addTo(map);
      line.current = L.polyline([], { color: "#1d4ed8", weight: 4, opacity: 0.7, dashArray: "2 10", lineCap: "round" }).addTo(map);
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    import("leaflet").then((L) => {
      if (me) {
        if (meMarker.current) meMarker.current.setLatLng([me.lat, me.lng]);
        else {
          meMarker.current = L.marker([me.lat, me.lng], {
            icon: L.divIcon({ html: pin("🛵", "blue", true), className: "", iconSize: [40, 40], iconAnchor: [20, 20] }),
            zIndexOffset: 1000,
          }).addTo(map);
        }
      }
      const target = stage === "pickup" ? shop ?? dest : dest ?? shop;
      const from = me ?? (stage === "dropoff" ? shop : null);
      line.current?.setLatLngs(from && target ? [[from.lat, from.lng], [target.lat, target.lng]] : []);
      const pts = [me, shop, dest].filter(Boolean) as Point[];
      if (pts.length > 1 && (!fitted.current || (me && !map.getBounds().contains([me.lat, me.lng])))) {
        map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [50, 50], maxZoom: 16 });
        fitted.current = true;
      }
    });
  }, [ready, me, shop, dest, stage]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  if (!shop && !dest) return null;
  return (
    <div
      ref={containerRef}
      className="h-56 w-full overflow-hidden rounded-3xl border border-neutral-200 bg-blue-50 shadow-sm [&_.leaflet-control-attribution]:text-[9px]"
    />
  );
}
