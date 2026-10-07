// Custom delivery areas: a shape drawn on the map, stored as a list of [lat, lng] points.
// Pure functions, shared by the browser (map editor, shopper checks) and the server (validation).

export type LatLng = [number, number];

export const MIN_POINTS = 3;
export const MAX_POINTS = 40;
export const MAX_AREA_KM2 = 40000;
export const MIN_AREA_KM2 = 0.05;

/** Reads a stored value (jsonb) into a clean polygon, or null when it is missing or malformed. */
export function parsePolygon(value: unknown): LatLng[] | null {
  if (!Array.isArray(value) || value.length < MIN_POINTS) return null;
  const out: LatLng[] = [];
  for (const p of value) {
    if (!Array.isArray(p) || p.length < 2) return null;
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    out.push([lat, lng]);
  }
  return out;
}

/** Ray casting: is the point inside the shape? (Edge points count as inside.) */
export function pointInPolygon(lat: number, lng: number, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Approximate area in km² (flat projection around the shape's centre: accurate enough for city-scale shapes). */
export function polygonAreaKm2(polygon: LatLng[]): number {
  if (polygon.length < 3) return 0;
  const lat0 = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const pts = polygon.map(([lat, lng]) => [lng * kmPerDegLng, lat * kmPerDegLat]);
  let sum = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    sum += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(sum) / 2;
}

/** The middle of the shape's bounding box (for the pin and the distance shown to shoppers). */
export function polygonCenter(polygon: LatLng[]): LatLng {
  const lats = polygon.map((p) => p[0]);
  const lngs = polygon.map((p) => p[1]);
  return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
}

function ccw(a: LatLng, b: LatLng, c: LatLng): number {
  return (c[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (c[1] - a[1]);
}

function segmentsCross(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  const d1 = ccw(a, b, c);
  const d2 = ccw(a, b, d);
  const d3 = ccw(c, d, a);
  const d4 = ccw(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** A shape whose edges never cross each other (no bow-ties). */
export function isSimplePolygon(polygon: LatLng[]): boolean {
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Neighbouring edges share a corner; only compare edges that are not next to each other.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (segmentsCross(a, b, polygon[j], polygon[(j + 1) % n])) return false;
    }
  }
  return true;
}

/** Why a drawn shape can't be saved, or null when it is fine. */
export function polygonProblem(polygon: LatLng[] | null): string | null {
  if (!polygon) return null;
  if (polygon.length < MIN_POINTS) return `Draw at least ${MIN_POINTS} points.`;
  if (polygon.length > MAX_POINTS) return `Use at most ${MAX_POINTS} points.`;
  if (!isSimplePolygon(polygon)) return "The lines of the area cross each other. Drag the points so the shape does not cross itself.";
  const area = polygonAreaKm2(polygon);
  if (area < MIN_AREA_KM2) return "The area is too small.";
  if (area > MAX_AREA_KM2) return "The area is too large.";
  return null;
}
