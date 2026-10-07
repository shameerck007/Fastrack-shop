// Delivery time estimate, worked out from the distance between the store and the customer:
//   preparation + rider travel + a small buffer, shown as one time in minutes.
// An estimate from straight-line distance, not live traffic or rider supply.

export interface EtaSettings {
  /** Minutes the store takes to pack an order. */
  prepMinutes: number;
  /** Average rider speed in town traffic (km/h). */
  speedKmh: number;
  /** Minutes allowed for the rider to reach the store. */
  bufferMinutes: number;
}

export const DEFAULT_ETA_SETTINGS: EtaSettings = { prepMinutes: 10, speedKmh: 20, bufferMinutes: 5 };

/** Roads are longer than the straight line between two points. */
const ROAD_FACTOR = 1.3;
/** Past this, Express is not a sensible promise to show. */
const MAX_SHOWN_MINUTES = 120;

export interface EtaRange {
  lo: number;
  hi: number;
}

export function etaMinutes(distanceKm: number, s: EtaSettings = DEFAULT_ETA_SETTINGS): number {
  const speed = s.speedKmh > 0 ? s.speedKmh : DEFAULT_ETA_SETTINGS.speedKmh;
  return s.prepMinutes + ((Math.max(distanceKm, 0) * ROAD_FACTOR) / speed) * 60 + s.bufferMinutes;
}

/** One time, like Instamart or Swiggy Instamart: the estimate rounded to the nearest minute (never below 8). Null when it would be a silly Express promise. */
export function etaRange(distanceKm: number, s: EtaSettings = DEFAULT_ETA_SETTINGS): EtaRange | null {
  const total = etaMinutes(distanceKm, s);
  if (total > MAX_SHOWN_MINUTES) return null;
  const minutes = Math.max(8, Math.round(total));
  return { lo: minutes, hi: minutes };
}

export function formatEta(r: EtaRange): string {
  return r.lo === r.hi ? `${r.lo} min` : `${r.lo}–${r.hi} min`;
}

/** The slower of several stores (a cart with items from different stores arrives when the last one does). */
export function slowestEta(list: (EtaRange | null)[]): EtaRange | null {
  if (list.length === 0 || list.some((x) => x == null)) return null;
  return (list as EtaRange[]).reduce((a, b) => (b.hi > a.hi ? b : a));
}

export function fastestEta(list: (EtaRange | null)[]): EtaRange | null {
  const ok = list.filter((x): x is EtaRange => x != null);
  return ok.length === 0 ? null : ok.reduce((a, b) => (b.hi < a.hi ? b : a));
}
