/** Reads the live arrival estimate saved on an order (migrations 0089/0090) and says when, and whether it is late against the promise. */

export interface LiveEtaInput {
  status: string;
  live_eta_at?: string | null;
  live_eta_updated_at?: string | null;
  live_eta_stops?: number | null;
  live_eta_km?: number | string | null;
  estimated_delivery_at?: string | null;
}

export interface LiveEta {
  /** The arrival time the system last worked out from the rider's real position. */
  at: string;
  /** Minutes behind the time promised at checkout (0 when on time or ahead). */
  lateBy: number;
  /** Deliveries the rider makes before this one (0 = this order is next). */
  stopsBefore: number;
  km: number | null;
  /** Seconds since the estimate was refreshed, as of `nowMs`. */
  ageSec: number | null;
}

const ON_THE_ROAD = new Set(["rider_assigned", "out_for_delivery"]);

/** The live estimate for an order that is with a rider, or null when there isn't one (yet). `nowMs` is passed in so the page stays pure. */
export function liveEtaOf(o: LiveEtaInput, nowMs: number): LiveEta | null {
  if (!ON_THE_ROAD.has(o.status) || !o.live_eta_at) return null;
  const at = new Date(o.live_eta_at).getTime();
  const promised = o.estimated_delivery_at ? new Date(o.estimated_delivery_at).getTime() : null;
  const diff = promised != null ? Math.round((at - promised) / 60_000) : 0;
  return {
    at: o.live_eta_at,
    lateBy: diff >= 5 ? diff : 0,
    stopsBefore: Math.max(0, (o.live_eta_stops ?? 1) - 1),
    km: o.live_eta_km != null ? Number(o.live_eta_km) : null,
    ageSec: o.live_eta_updated_at ? Math.max(0, Math.round((nowMs - new Date(o.live_eta_updated_at).getTime()) / 1000)) : null,
  };
}

/** "7:42 PM" in the market's own clock. */
export function clockIn(iso: string, timeZone: string, locale = "en"): string {
  return new Date(iso).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", { hour: "numeric", minute: "2-digit", timeZone });
}
