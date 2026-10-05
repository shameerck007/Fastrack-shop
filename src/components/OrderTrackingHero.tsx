"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_URL, TILE_OPTIONS } from "@/lib/map-config";
import { createClient } from "@/lib/supabase/client";
import { distanceKm } from "@/lib/delivery-geo";
import { useLocale } from "@/components/LocaleProvider";
import type { OrderStatus } from "@/types/database";

interface Point {
  lat: number;
  lng: number;
}

export interface TrackingRider {
  id: string;
  name: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
}

// Straight-line distance understates road distance; scooter speed in city traffic.
const ROAD_FACTOR = 1.35;
const SPEED_KMH = 24;
const PREP_MINUTES = 15;

const STEPS = [
  { key: "step_placed", icon: "🧾", statuses: ["pending", "confirmed"] },
  { key: "step_preparing", icon: "🍳", statuses: ["preparing", "ready_for_pickup"] },
  { key: "step_on_way", icon: "🛵", statuses: ["rider_assigned", "out_for_delivery"] },
  { key: "step_delivered", icon: "✅", statuses: ["delivered"] },
] as const;

function pin(emoji: string, tone: "blue" | "white", pulse = false) {
  const bg = tone === "blue" ? "background:#1d4ed8;color:#fff" : "background:#fff;color:#111";
  return (
    `<div style="position:relative;width:40px;height:40px">` +
    (pulse ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:rgba(37,99,235,.25);animation:ping 1.6s cubic-bezier(0,0,.2,1) infinite"></span>` : "") +
    `<div style="position:relative;width:40px;height:40px;border-radius:9999px;${bg};display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,.25);border:3px solid #fff">${emoji}</div>` +
    `</div>`
  );
}

/** The rider: pulsing ring, blue disc and a scooter that flips to face the way it is travelling. */
function riderPin() {
  return (
    `<div style="position:relative;width:44px;height:44px">` +
    `<span style="position:absolute;inset:-8px;border-radius:9999px;background:rgba(37,99,235,.28);animation:ping 1.8s cubic-bezier(0,0,.2,1) infinite"></span>` +
    `<div style="position:relative;width:44px;height:44px;border-radius:9999px;background:linear-gradient(135deg,#2563eb,#1d4ed8);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(29,78,216,.45);border:3px solid #fff">` +
    `<span class="ft-rider" style="display:inline-block;font-size:22px;line-height:1;transition:transform .35s ease">🛵</span></div>` +
    `</div>`
  );
}

/** Keeta-style live tracking: full-width map with shop, rider and your address, plus a
 * bottom sheet with the status, estimated arrival, progress steps and rider contact. */
export default function OrderTrackingHero({
  orderId,
  orderNumber,
  initialStatus,
  rider,
  dest,
  shop,
}: {
  orderId: string;
  orderNumber: string;
  initialStatus: OrderStatus;
  rider: TrackingRider | null;
  dest: Point | null;
  shop: (Point & { name: string }) | null;
}) {
  const { t, locale } = useLocale();
  const [status, setStatus] = useState(initialStatus);
  const [riderPos, setRiderPos] = useState<Point | null>(
    rider?.lat != null && rider?.lng != null ? { lat: rider.lat, lng: rider.lng } : null
  );
  const [live, setLive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const riderMarker = useRef<Marker | null>(null);
  const routeLine = useRef<Polyline | null>(null);
  const routeCasing = useRef<Polyline | null>(null);
  const shownPos = useRef<Point | null>(null);
  const animFrame = useRef<number | null>(null);
  const lastRouteFetch = useRef<{ from: Point; to: string; at: number } | null>(null);
  const [road, setRoad] = useState<{ points: [number, number][]; sec: number; target: string } | null>(null);
  const fitted = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  const riderId = rider?.id ?? null;
  const done = status === "delivered" || status === "cancelled";

  // Status and rider position arrive over realtime (the session must be awaited
  // first, otherwise the socket connects as anon and RLS drops every event).
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`order-tracking-${orderId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, (payload) => {
          const next = payload.new as { status?: OrderStatus };
          if (next.status) setStatus(next.status);
        });
      if (riderId) {
        channel = channel.on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "delivery_partners", filter: `id=eq.${riderId}` },
          (payload) => {
            const next = payload.new as { current_lat: number | null; current_lng: number | null };
            if (next.current_lat != null && next.current_lng != null) {
              setRiderPos({ lat: next.current_lat, lng: next.current_lng });
              setLive(true);
            }
          }
        );
      }
      channel.subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orderId, riderId]);

  const hasMap = !!(dest || shop || riderPos);

  // Build the map once.
  useEffect(() => {
    if (!hasMap || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const center = riderPos ?? dest ?? shop!;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView([center.lat, center.lng], 15);
      L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
      L.control.attribution({ prefix: false, position: "bottomleft" }).addTo(map);
      const icon = (html: string) => L.divIcon({ html, className: "", iconSize: [40, 40], iconAnchor: [20, 20] });
      if (shop) L.marker([shop.lat, shop.lng], { icon: icon(pin("🏪", "white")) }).addTo(map);
      if (dest) L.marker([dest.lat, dest.lng], { icon: icon(pin("🏠", "blue")) }).addTo(map);
      if (riderPos) {
        riderMarker.current = L.marker([riderPos.lat, riderPos.lng], {
          icon: L.divIcon({ html: riderPin(), className: "", iconSize: [44, 44], iconAnchor: [22, 22] }),
          zIndexOffset: 1000,
        }).addTo(map);
        shownPos.current = riderPos;
      }
      routeCasing.current = L.polyline([], { color: "#ffffff", weight: 9, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(map);
      routeLine.current = L.polyline([], { color: "#1d4ed8", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMap]);

  // Keep the rider marker, route line and viewport in step with the rider's position.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    import("leaflet").then((L) => {
      // Before pickup the route is rider -> shop; afterwards rider/shop -> you.
      const from: Point | null = riderPos ?? shop;
      const headingToShop = status === "rider_assigned" && !!riderPos && !!shop;
      const to: Point | null = headingToShop ? shop : dest;
      if (riderPos) {
        if (riderMarker.current) glideTo(riderPos);
        else {
          riderMarker.current = L.marker([riderPos.lat, riderPos.lng], {
            icon: L.divIcon({ html: riderPin(), className: "", iconSize: [44, 44], iconAnchor: [22, 22] }),
            zIndexOffset: 1000,
          }).addTo(map);
          shownPos.current = riderPos;
        }
      }
      // Road route when we have it for this leg; otherwise a straight dotted guide.
      const targetKey = to ? `${to.lat.toFixed(5)},${to.lng.toFixed(5)}` : "";
      const onRoad = !!road && road.target === targetKey && road.points.length > 1 && !done;
      if (onRoad && road) {
        routeCasing.current?.setLatLngs(road.points);
        routeLine.current?.setLatLngs(road.points);
        routeLine.current?.setStyle({ dashArray: undefined, weight: 5, opacity: 0.9 });
      } else {
        routeCasing.current?.setLatLngs([]);
        routeLine.current?.setLatLngs(from && to && !done ? [[from.lat, from.lng], [to.lat, to.lng]] : []);
        routeLine.current?.setStyle({ dashArray: "2 10", weight: 4, opacity: 0.7 });
      }
      const pts = [riderPos, dest, shop].filter(Boolean) as Point[];
      if (pts.length > 1 && (!fitted.current || (riderPos && !map.getBounds().contains([riderPos.lat, riderPos.lng])))) {
        map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [60, 60], maxZoom: 16 });
        fitted.current = true;
      }
    });
  }, [mapReady, riderPos, status, dest, shop, done, road]);

  /** Slide the scooter to its new position instead of jumping, flipping it to face east or west. */
  function glideTo(target: Point) {
    const marker = riderMarker.current;
    const start = shownPos.current ?? target;
    if (!marker) return;
    if (animFrame.current != null) cancelAnimationFrame(animFrame.current);
    const dLng = target.lng - start.lng;
    const face = marker.getElement()?.querySelector<HTMLElement>(".ft-rider");
    if (face && Math.abs(dLng) > 0.000005) face.style.transform = dLng > 0 ? "scaleX(-1)" : "scaleX(1)";
    const t0 = performance.now();
    const duration = 2200;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // ease in-out
      const cur = { lat: start.lat + (target.lat - start.lat) * e, lng: start.lng + (target.lng - start.lng) * e };
      marker.setLatLng([cur.lat, cur.lng]);
      shownPos.current = cur;
      animFrame.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    animFrame.current = requestAnimationFrame(step);
  }

  // Road route for the current leg (rider -> shop before pickup, rider -> you after).
  // Refetched when the rider has moved about 60 m, the leg changes, or every 25 seconds.
  useEffect(() => {
    // Before a rider is on the map the route still follows the roads, shop -> you.
    const origin = riderPos ?? shop;
    if (done || !origin) return;
    const headingToShop = status === "rider_assigned" && !!riderPos && !!shop;
    const to = headingToShop ? shop : dest;
    if (!to) return;
    const targetKey = `${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
    const last = lastRouteFetch.current;
    const movedKm = last ? distanceKm(last.from.lat, last.from.lng, origin.lat, origin.lng) : Infinity;
    if (last && last.to === targetKey && movedKm < 0.06 && Date.now() - last.at < 25_000) return;
    lastRouteFetch.current = { from: origin, to: targetKey, at: Date.now() };
    let cancelled = false;
    fetch(`/api/geo/route?from=${origin.lat},${origin.lng}&to=${to.lat},${to.lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { points?: [number, number][]; durationSec?: number } | null) => {
        if (cancelled || !data?.points || data.points.length < 2) return;
        setRoad({ points: data.points, sec: data.durationSec ?? 0, target: targetKey });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [riderPos, status, dest, shop, done]);

  useEffect(
    () => () => {
      if (animFrame.current != null) cancelAnimationFrame(animFrame.current);
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  // Estimated minutes left.
  const etaMinutes = useMemo(() => {
    if (done || !dest) return null;
    const leg = (a: Point, b: Point) => ((distanceKm(a.lat, a.lng, b.lat, b.lng) * ROAD_FACTOR) / SPEED_KMH) * 60;
    let minutes: number;
    const destKey = `${dest.lat.toFixed(5)},${dest.lng.toFixed(5)}`;
    const shopKey = shop ? `${shop.lat.toFixed(5)},${shop.lng.toFixed(5)}` : "";
    const roadMin = road && road.sec > 0 ? road.sec / 60 : null;
    if (status === "out_for_delivery" && riderPos) minutes = roadMin != null && road?.target === destKey ? roadMin : leg(riderPos, dest);
    else if (status === "rider_assigned" && riderPos && shop)
      minutes = (roadMin != null && road?.target === shopKey ? roadMin : leg(riderPos, shop)) + 3 + leg(shop, dest);
    else if (shop) minutes = PREP_MINUTES + leg(shop, dest);
    else return null;
    return Math.max(2, Math.round(minutes));
  }, [status, riderPos, dest, shop, done, road]);

  const arrival = useMemo(() => {
    if (etaMinutes == null) return null;
    const fmt = (d: Date) => d.toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" });
    const from = new Date(Date.now() + etaMinutes * 60_000);
    const to = new Date(from.getTime() + 10 * 60_000);
    return `${fmt(from)} – ${fmt(to)}`;
  }, [etaMinutes, locale]);

  const stepIndex = Math.max(
    0,
    STEPS.findIndex((s) => (s.statuses as readonly string[]).includes(status))
  );
  const title =
    status === "cancelled"
      ? t("tracking.title_cancelled")
      : status === "delivered"
        ? t("tracking.title_delivered")
        : status === "out_for_delivery"
          ? t("tracking.title_delivering")
          : status === "rider_assigned"
            ? t("tracking.title_pickup")
            : status === "preparing" || status === "ready_for_pickup"
              ? t("tracking.title_preparing")
              : t("tracking.title_placed");

  return (
    <section className="-mx-4 -mt-6 mb-6 md:mx-0 md:mt-0 md:overflow-hidden md:rounded-3xl md:border md:border-neutral-200 md:shadow-sm">
      {hasMap && (
        <div className="relative">
          <div ref={containerRef} className="h-[46vh] min-h-[260px] w-full bg-blue-50 md:h-[380px] [&_.leaflet-bottom]:mb-7 md:[&_.leaflet-bottom]:mb-0 [&_.leaflet-control-attribution]:text-[9px]" />
          {live && !done && (
            <span className="absolute start-3 top-3 z-[500] flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-600 shadow-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {t("tracking.live")}
            </span>
          )}
          {etaMinutes != null && (
            <span className="absolute end-3 top-3 z-[500] rounded-full bg-blue-700 px-3 py-1.5 text-xs font-extrabold text-white shadow-lg">
              {t("tracking.arriving_in", { min: etaMinutes })}
            </span>
          )}
        </div>
      )}

      <div className={`relative z-[600] bg-white px-5 pb-5 pt-5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] ${hasMap ? "-mt-6 rounded-t-3xl md:mt-0 md:rounded-none md:shadow-none" : "rounded-3xl"}`}>
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-500">#{orderNumber}</p>

        {arrival && (
          <div className="mt-3 rounded-2xl bg-blue-50 px-4 py-3">
            <p className="text-xs font-medium text-blue-700">{t("tracking.eta_label")}</p>
            <p className="text-lg font-extrabold text-blue-900">{arrival}</p>
          </div>
        )}

        {status !== "cancelled" && (
          <ol className="mt-4 grid grid-cols-4 gap-1.5">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex flex-col items-center gap-1 text-center">
                <span className={`h-1.5 w-full rounded-full ${i <= stepIndex ? "bg-blue-600" : "bg-neutral-200"}`} />
                <span className={`text-lg ${i <= stepIndex ? "" : "opacity-40 grayscale"}`}>{s.icon}</span>
                <span className={`text-[11px] font-semibold leading-tight ${i <= stepIndex ? "text-neutral-900" : "text-neutral-400"}`}>
                  {t(`tracking.${s.key}`)}
                </span>
              </li>
            ))}
          </ol>
        )}

        {rider && !done && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-neutral-200 p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
              {(rider.name ?? "R").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-neutral-500">{t("tracking.rider_label")}</p>
              <p className="truncate font-bold text-neutral-900">{rider.name ?? "—"}</p>
            </div>
            <a
              href="#order-chat"
              className="flex h-10 items-center rounded-full border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 active:scale-95"
            >
              {t("tracking.chat")}
            </a>
            {rider.phone && (
              <a
                href={`tel:${rider.phone}`}
                className="flex h-10 items-center rounded-full bg-blue-700 px-4 text-sm font-semibold text-white active:scale-95"
              >
                {t("tracking.call")}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
