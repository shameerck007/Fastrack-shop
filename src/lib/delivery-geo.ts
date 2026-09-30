// Pure geometry shared by server code and the browser (no server imports).

export interface Coords {
  lat: number | null;
  lng: number | null;
}

export interface ZoneCircle {
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
}

export type ZoneVerdict =
  | { ok: true }
  | { ok: false; reason: "no_location" }
  | { ok: false; reason: "outside"; distanceKm: number; radiusKm: number };

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** radiusKm null (or no centre) means no boundary is set, i.e. unrestricted. */
export function checkZone(zone: ZoneCircle | undefined, coords: Coords | null): ZoneVerdict {
  if (!zone || zone.radiusKm == null || zone.lat == null || zone.lng == null) return { ok: true };
  if (!coords || coords.lat == null || coords.lng == null) return { ok: false, reason: "no_location" };
  const d = distanceKm(zone.lat, zone.lng, coords.lat, coords.lng);
  if (d <= zone.radiusKm) return { ok: true };
  return { ok: false, reason: "outside", distanceKm: d, radiusKm: zone.radiusKm };
}
