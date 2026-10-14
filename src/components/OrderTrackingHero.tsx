"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_URL, TILE_OPTIONS } from "@/lib/map-config";
import { createClient } from "@/lib/supabase/client";
import { distanceKm } from "@/lib/delivery-geo";
import { etaMinutes as estimateMinutes } from "@/lib/eta";
import { useLocale } from "@/components/LocaleProvider";
import type { OrderStatus } from "@/types/database";
import { BRAND } from "@/lib/brand";
import { riderIconSvg } from "@/lib/rider-icon";
import { pinHtml, PIN_ANCHOR, PIN_SIZE } from "@/lib/map-pin";

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
  /** Shown on the rider card (from order_rider_card). */
  rating?: number | null;
  ratingCount?: number;
  deliveries?: number;
  vehicle?: string | null;
  plateEnd?: string | null;
}

// Straight-line distance understates road distance; scooter speed in city traffic.
// Live legs (rider to shop, rider to customer) use town-traffic speed; the first estimate comes from the time promised at checkout.
const ROAD_FACTOR = 1.3;
const SPEED_KMH = 20;

const STEPS = [
  { key: "step_placed", statuses: ["pending", "confirmed"] },
  { key: "step_preparing", statuses: ["preparing", "ready_for_pickup"] },
  { key: "step_on_way", statuses: ["rider_assigned", "out_for_delivery"] },
  { key: "step_delivered", statuses: ["delivered"] },
] as const;

/** One clean line icon per step (they take the colour of the circle: white once reached, grey before). */
function StepIcon({ step }: { step: (typeof STEPS)[number]["key"] }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" focusable="false">
      {step === "step_placed" && (
        <g {...common}>
          <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
          <path d="M8 6H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1" />
          <path d="M9 14.5l2 2 4-4.5" />
        </g>
      )}
      {step === "step_preparing" && (
        <g {...common}>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
        </g>
      )}
      {step === "step_on_way" && (
        <g {...common}>
          <circle cx="6" cy="17" r="2.6" />
          <circle cx="18" cy="17" r="2.6" />
          <path d="M8.6 17h6.8l2-7.5H14M16 9.5l.8-3h2.2M5 17l1.6-5.5H12" />
        </g>
      )}
      {step === "step_delivered" && (
        <g {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l3 3 5-6" />
        </g>
      )}
    </svg>
  );
}

/** A small FasTrack rider picture for inline text (replaces the scooter emoji). */
function RiderBadge({ size = 16 }: { size?: number }) {
  return <span className="inline-block align-[-0.25em]" dangerouslySetInnerHTML={{ __html: riderIconSvg(size) }} />;
}

function pin(emoji: string, tone: "blue" | "white", pulse = false) {
  const bg = tone === "blue" ? "background:#005fb0;color:#fff" : "background:#fff;color:#111";
  return (
    `<div style="position:relative;width:40px;height:40px">` +
    (pulse ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:rgba(0,112,208,.25);animation:ping 1.6s cubic-bezier(0,0,.2,1) infinite"></span>` : "") +
    `<div style="position:relative;width:40px;height:40px;border-radius:9999px;${bg};display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,.25);border:3px solid #fff">${emoji}</div>` +
    `</div>`
  );
}

/** The rider: pulsing ring, white disc and the FasTrack rider (drawn facing east) that flips to face the way it is travelling. */
function riderPin() {
  return (
    `<div style="position:relative;width:60px;height:60px">` +
    `<span style="position:absolute;inset:-8px;border-radius:9999px;background:rgba(0,112,208,.28);animation:ping 1.8s cubic-bezier(0,0,.2,1) infinite"></span>` +
    `<div style="position:relative;width:60px;height:60px;border-radius:9999px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,95,176,.45);border:3px solid #0070d0">` +
    `<span class="ft-rider" style="display:inline-block;line-height:0;transition:transform .35s ease">${riderIconSvg(30, true)}</span></div>` +
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
  promisedAt = null,
  liveEtaAt = null,
  liveStops = null,
}: {
  orderId: string;
  orderNumber: string;
  initialStatus: OrderStatus;
  rider: TrackingRider | null;
  dest: Point | null;
  shop: (Point & { name: string }) | null;
  /** The delivery time promised when the order was placed (ISO), so this screen agrees with checkout and the email. */
  promisedAt?: string | null;
  /** The arrival time the system last worked out from the rider's real position (ISO). */
  liveEtaAt?: string | null;
  /** How many deliveries the rider makes up to and including this one (1 = this order is next). */
  liveStops?: number | null;
}) {
  const { t, locale } = useLocale();
  const [status, setStatus] = useState(initialStatus);
  const [riderPos, setRiderPos] = useState<Point | null>(
    rider?.lat != null && rider?.lng != null ? { lat: rider.lat, lng: rider.lng } : null
  );
  const [live, setLive] = useState(false);
  const [liveEta, setLiveEta] = useState<string | null>(liveEtaAt);
  const [stops, setStops] = useState<number>(liveStops ?? 1);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const riderMarker = useRef<Marker | null>(null);
  // True when the road route for the current leg could not be fetched: only then is a straight dotted guide drawn instead.
  const [roadFailed, setRoadFailed] = useState(false);
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
          const next = payload.new as { status?: OrderStatus; live_eta_at?: string | null; live_eta_stops?: number | null };
          if (next.status) setStatus(next.status);
          if (next.live_eta_at) setLiveEta(next.live_eta_at);
          if (next.live_eta_stops) setStops(next.live_eta_stops);
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
      const stopIcon = (emoji: string) => L.divIcon({ html: pinHtml(emoji), className: "", iconSize: PIN_SIZE, iconAnchor: PIN_ANCHOR });
      if (shop) L.marker([shop.lat, shop.lng], { icon: stopIcon("🏪") }).addTo(map);
      if (dest) L.marker([dest.lat, dest.lng], { icon: stopIcon("🏠") }).addTo(map);
      if (riderPos) {
        riderMarker.current = L.marker([riderPos.lat, riderPos.lng], {
          icon: L.divIcon({ html: riderPin(), className: "", iconSize: [60, 60], iconAnchor: [30, 30] }),
          zIndexOffset: 1000,
        }).addTo(map);
        shownPos.current = riderPos;
      }
      routeCasing.current = L.polyline([], { color: "#ffffff", weight: 9, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(map);
      routeLine.current = L.polyline([], { color: BRAND[700], weight: 7, opacity: 1, dashArray: "0.1 11", lineCap: "round", lineJoin: "round" }).addTo(map);
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
            icon: L.divIcon({ html: riderPin(), className: "", iconSize: [60, 60], iconAnchor: [30, 30] }),
            zIndexOffset: 1000,
          }).addTo(map);
          shownPos.current = riderPos;
        }
      }
      // Road route when we have it for this leg; otherwise a straight dotted guide.
      const targetKey = to ? `${to.lat.toFixed(5)},${to.lng.toFixed(5)}` : "";
      const onRoad = !!road && road.target === targetKey && road.points.length > 1 && !done;
      if (onRoad && road) {
        // Round dots along the road, in FasTrack blue (zero-length dashes + round caps = dots).
        routeCasing.current?.setLatLngs([]);
        // The dotted road starts at the rider, so the part already travelled disappears as the vehicle moves along.
        let ahead = road.points;
        if (riderPos) {
          let best = 0;
          let bestD = Infinity;
          road.points.forEach((pt, i) => {
            const d = (pt[0] - riderPos.lat) ** 2 + (pt[1] - riderPos.lng) ** 2;
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          });
          ahead = [[riderPos.lat, riderPos.lng], ...road.points.slice(best + 1)];
        }
        routeLine.current?.setLatLngs(ahead);
        routeLine.current?.setStyle({ dashArray: "0.1 11", weight: 7, opacity: 1, lineCap: "round" });
      } else {
        // While the road route is on its way nothing is drawn (a straight line that then jumps onto the roads looked broken);
        // the straight guide appears only if the road route could not be fetched.
        routeCasing.current?.setLatLngs([]);
        routeLine.current?.setLatLngs(roadFailed && from && to && !done ? [[from.lat, from.lng], [to.lat, to.lng]] : []);
        routeLine.current?.setStyle({ dashArray: "0.1 11", weight: 6, opacity: 0.55, lineCap: "round" });
      }
      const pts = [riderPos, dest, shop].filter(Boolean) as Point[];
      if (pts.length > 1 && (!fitted.current || (riderPos && !map.getBounds().contains([riderPos.lat, riderPos.lng])))) {
        map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [60, 60], maxZoom: 16 });
        fitted.current = true;
      }
    });
  }, [mapReady, riderPos, status, dest, shop, done, road, roadFailed]);

  /** Slide the scooter to its new position instead of jumping, flipping it to face east or west. */
  function glideTo(target: Point) {
    const marker = riderMarker.current;
    const start = shownPos.current ?? target;
    if (!marker) return;
    if (animFrame.current != null) cancelAnimationFrame(animFrame.current);
    const dLng = target.lng - start.lng;
    const face = marker.getElement()?.querySelector<HTMLElement>(".ft-rider");
    if (face && Math.abs(dLng) > 0.000005) face.style.transform = dLng > 0 ? "scaleX(1)" : "scaleX(-1)";
    const t0 = performance.now();
    const duration = 4500; // a little under the 5 s between location updates, so the vehicle keeps moving
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
        if (cancelled) return;
        if (!data?.points || data.points.length < 2) return setRoadFailed(true);
        setRoadFailed(false);
        setRoad({ points: data.points, sec: data.durationSec ?? 0, target: targetKey });
      })
      .catch(() => !cancelled && setRoadFailed(true));
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

  // Minutes left. Before the rider is on the way this is the time promised at checkout counting down (so it matches what the
  // customer was told); once the rider moves it follows the road distance. A late order shows the longer, honest time.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const etaMinutes = useMemo(() => {
    if (done || !dest) return null;
    const leg = (a: Point, b: Point) => ((distanceKm(a.lat, a.lng, b.lat, b.lng) * ROAD_FACTOR) / SPEED_KMH) * 60;
    const destKey = `${dest.lat.toFixed(5)},${dest.lng.toFixed(5)}`;
    const shopKey = shop ? `${shop.lat.toFixed(5)},${shop.lng.toFixed(5)}` : "";
    const roadMin = road && road.sec > 0 ? road.sec / 60 : null;
    let minutes: number | null = null;
    const onRoute = stops > 1 && !!liveEta && (status === "rider_assigned" || status === "out_for_delivery");
    if (onRoute) minutes = (new Date(liveEta as string).getTime() - now) / 60_000;
    else if (status === "out_for_delivery" && riderPos) minutes = roadMin != null && road?.target === destKey ? roadMin : leg(riderPos, dest);
    else if (status === "rider_assigned" && riderPos && shop)
      minutes = (roadMin != null && road?.target === shopKey ? roadMin : leg(riderPos, shop)) + 3 + leg(shop, dest);
    if (minutes == null && liveEta && (status === "rider_assigned" || status === "out_for_delivery")) minutes = (new Date(liveEta).getTime() - now) / 60_000;
    if (minutes == null && promisedAt) minutes = (new Date(promisedAt).getTime() - now) / 60_000;
    if (minutes == null && shop) minutes = estimateMinutes(distanceKm(shop.lat, shop.lng, dest.lat, dest.lng));
    if (minutes == null) return null;
    return Math.max(2, Math.round(minutes));
  }, [status, riderPos, dest, shop, done, road, promisedAt, liveEta, stops, now]);

  const arrival = useMemo(() => {
    if (etaMinutes == null) return null;
    return new Date(now + etaMinutes * 60_000).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", { hour: "numeric", minute: "2-digit" });
  }, [etaMinutes, locale, now]);

  // On time or late, against the time promised at checkout.
  const lateBy = useMemo(() => {
    if (etaMinutes == null || !promisedAt || done) return 0;
    const diff = Math.round((now + etaMinutes * 60_000 - new Date(promisedAt).getTime()) / 60_000);
    return diff >= 5 ? diff : 0;
  }, [etaMinutes, promisedAt, done, now]);

  // The journey bar: rider -> shop is the first quarter, shop -> you the rest. The scooter sits where the rider really is.
  const journey = useMemo(() => {
    if (status === "delivered") return { pos: 100, kmAway: 0 };
    const shopToYou = shop && dest ? Math.max(0.3, distanceKm(shop.lat, shop.lng, dest.lat, dest.lng)) : null;
    if (status === "out_for_delivery" && riderPos && dest && shopToYou) {
      const left = distanceKm(riderPos.lat, riderPos.lng, dest.lat, dest.lng);
      return { pos: 25 + 75 * Math.min(1, Math.max(0, 1 - left / shopToYou)), kmAway: left };
    }
    if (status === "rider_assigned" && riderPos && shop) {
      const toShop = distanceKm(riderPos.lat, riderPos.lng, shop.lat, shop.lng);
      return { pos: 25 * Math.min(1, Math.max(0, 1 - toShop / 3)), kmAway: toShop + (shopToYou ?? 0) };
    }
    return { pos: status === "preparing" || status === "ready_for_pickup" ? 25 : 8, kmAway: shopToYou };
  }, [status, riderPos, shop, dest]);

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
              : status === "pending"
                ? t("tracking.title_waiting")
                : t("tracking.title_placed");
  // Like Instamart and Noon: until the shop accepts the order there is no rider, no distance and no moving vehicle, so the card says
  // what is really happening (waiting for the shop) instead of counting down a delivery time. The rider appears once one is assigned.
  const waitingForShop = status === "pending";
  const riderOn = status === "rider_assigned" || status === "out_for_delivery";
  const overdueWaiting = waitingForShop && !!promisedAt && now > new Date(promisedAt).getTime() + 10 * 60_000;

  return (
    <section className="isolate -mx-4 -mt-6 mb-6 md:mx-0 md:mt-0 md:overflow-hidden md:rounded-3xl md:border md:border-neutral-200 md:shadow-sm">
      {hasMap && (
        <div className="relative">
          <div ref={containerRef} className="h-[46vh] min-h-[260px] w-full bg-brand-50 md:h-[380px] [&_.leaflet-bottom]:mb-7 md:[&_.leaflet-bottom]:mb-0 [&_.leaflet-control-attribution]:text-[9px]" />
          {live && !done && (
            <span className="absolute start-3 top-3 z-[500] flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-600 shadow-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {t("tracking.live")}
            </span>
          )}
          {etaMinutes != null && !waitingForShop && (
            <span className="absolute end-3 top-3 z-[500] rounded-full bg-brand-700 px-3 py-1.5 text-xs font-extrabold text-white shadow-lg">
              {t("tracking.arriving_in", { min: etaMinutes })}
            </span>
          )}
        </div>
      )}

      <div className={`relative z-[600] bg-white px-5 pb-5 pt-5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] ${hasMap ? "-mt-6 rounded-t-3xl md:mt-0 md:rounded-none md:shadow-none" : "rounded-3xl"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight text-neutral-900">{title}</h2>
            <p className="text-sm text-neutral-500">#{orderNumber}</p>
          </div>
          {live && !done && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {t("tracking.live")}
            </span>
          )}
        </div>

        {waitingForShop && (
          <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-neutral-900 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm ring-1 ring-brand-100">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/30" />
                <span className="relative"><StepIcon step="step_preparing" /></span>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold">{overdueWaiting ? t("tracking.waiting_slow") : t("tracking.waiting_title")}</p>
                <p className="mt-0.5 text-xs text-neutral-600">{overdueWaiting ? t("tracking.waiting_slow_hint") : t("tracking.waiting_hint")}</p>
              </div>
            </div>
            {!overdueWaiting && arrival && <p className="mt-3 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 ring-1 ring-brand-100">{t("tracking.waiting_eta", { time: arrival })}</p>}
          </div>
        )}

        {etaMinutes != null && !done && !waitingForShop && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 p-4 text-neutral-900 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">{t("tracking.eta_label")}</p>
                <p className="mt-0.5 flex items-baseline gap-1.5 leading-none">
                  <span className="font-mono text-5xl font-extrabold tabular-nums">{etaMinutes}</span>
                  <span className="text-lg font-bold text-brand-700">min</span>
                </p>
              </div>
              <div className="text-end">
                {arrival && <p className="text-lg font-extrabold">{arrival}</p>}
                <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${lateBy > 0 ? "bg-amber-100 text-amber-900" : "bg-white text-emerald-700 ring-1 ring-emerald-200"}`}>
                  <span aria-hidden>{lateBy > 0 ? "!" : "✓"}</span>
                  {lateBy > 120 ? "Delayed" : lateBy > 0 ? t("tracking.running_late", { min: lateBy }) : t("tracking.on_time")}
                </span>
              </div>
            </div>

            {stops > 1 && (
              <p className="mt-3 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 ring-1 ring-brand-100"><RiderBadge size={18} /> {t("tracking.stops_before", { count: stops - 1, plural: stops - 1 === 1 ? "" : "s" })}</p>
            )}

            <div className="mt-5">
              {/* The road from the rider to the customer: the FasTrack rider on the tarmac, the home at the end. */}
              <div className="relative h-[4.75rem]">
                {/* a slim road: tarmac, a dashed centre line, the covered part lit in brand blue */}
                <div className="absolute inset-x-0 bottom-2 h-3 overflow-hidden rounded-full bg-brand-950">
                  <div className="absolute inset-y-0 start-0 rounded-full bg-brand-500 transition-[width] duration-[1500ms] ease-out" style={{ width: `calc(1.5rem + (100% - 3rem) * ${journey.pos / 100})` }} />
                  <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 opacity-70" style={{ backgroundImage: "repeating-linear-gradient(90deg,#fff 0 8px,transparent 8px 16px)" }} />
                </div>
                {/* the customer's home at the end of the road */}
                <span className="absolute bottom-5 end-1 flex flex-col items-center" aria-hidden>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base shadow ring-2 ring-brand-300">🏠</span>
                  <span className="h-1.5 w-0.5 bg-brand-300" />
                </span>
                {/* the rider, wheels on the road */}
                <span
                  className="absolute bottom-[1.1rem] -translate-x-1/2 transition-[left] duration-[1500ms] ease-out"
                  style={{ left: `calc(1.5rem + (100% - 3rem) * ${journey.pos / 100})` }}
                  aria-hidden
                >
                  {riderOn ? (
                    <span className="block" dangerouslySetInnerHTML={{ __html: riderIconSvg(44) }} />
                  ) : (
                    <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-700 shadow ring-2 ring-brand-300">
                      <StepIcon step="step_preparing" />
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                <span>{riderOn ? t("tracking.stage_rider") : t("tracking.stage_shop")}</span>
                <span>{riderOn && journey.kmAway != null ? t("tracking.km_away", { km: journey.kmAway.toFixed(1) }) : ""}</span>
                <span>{t("tracking.stage_you")}</span>
              </div>
            </div>
          </div>
        )}

        {status !== "cancelled" && (
          <ol className="mt-5 grid grid-cols-4 gap-1.5">
            {STEPS.map((s, i) => {
              const reached = i <= stepIndex;
              const current = i === stepIndex && !done;
              return (
                <li key={s.key} className="flex flex-col items-center gap-1.5 text-center">
                  <span className={`relative flex h-11 w-11 items-center justify-center rounded-full transition ${reached ? "bg-brand-600 text-white shadow-md shadow-brand-600/30" : "bg-neutral-100 text-neutral-400"}`}>
                    {current && <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/40" />}
                    <span className="relative"><StepIcon step={s.key} /></span>
                  </span>
                  <span className={`text-[11px] font-semibold leading-tight ${reached ? "text-neutral-900" : "text-neutral-500"}`}>{t(`tracking.${s.key}`)}</span>
                  <span className={`h-1 w-full rounded-full ${reached ? "bg-brand-600" : "bg-neutral-200"}`} />
                </li>
              );
            })}
          </ol>
        )}

        {rider && !done && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-neutral-200 p-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-indigo-100 text-lg font-bold text-brand-700">
              {(rider.name ?? "R").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-neutral-500">{t("tracking.rider_label")}</p>
              <p className="truncate font-bold text-neutral-900">{rider.name ?? "—"}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                {rider.rating != null && Number(rider.rating) > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                    ★ {Number(rider.rating).toFixed(1)}
                    {rider.ratingCount ? <span className="font-normal text-neutral-500">({rider.ratingCount})</span> : null}
                  </span>
                ) : (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">New rider</span>
                )}
                {rider.deliveries ? <span>{rider.deliveries} deliveries</span> : null}
                {rider.vehicle || rider.plateEnd ? (
                  <span>
                    <RiderBadge size={16} /> {rider.vehicle ?? "Bike"}
                    {rider.plateEnd ? ` · plate …${rider.plateEnd}` : ""}
                  </span>
                ) : null}
              </p>
            </div>
            <a href="#order-chat" className="flex h-10 items-center rounded-full border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 active:scale-95">
              {t("tracking.chat")}
            </a>
            {rider.phone && (
              <a href={`tel:${rider.phone}`} className="flex h-10 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-white active:scale-95">
                {t("tracking.call")}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
