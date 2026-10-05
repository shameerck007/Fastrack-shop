// Map tiles come from HERE, fetched through our own /api/geo/tile route so the HERE key
// stays on the server (the route falls back to Esri's free street tiles if HERE is
// unavailable). English labels, shop/business detail and building outlines.
export const TILE_URL = "/api/geo/tile/{z}/{x}/{y}";

export const TILE_OPTIONS = {
  attribution:
    '&copy; <a href="https://www.here.com/" target="_blank">HERE</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
  maxZoom: 19,
  tileSize: 256,
  detectRetina: false,
};

export const MARKER_ICON = {
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41] as [number, number],
  iconAnchor: [12, 41] as [number, number],
};

export const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753]; // Riyadh

export interface PlaceResult {
  label: string;
  detail: string;
  lat: number;
  lng: number;
}

// Both routed through our own server (see src/app/api/geo/*) rather than
// calling Nominatim directly from the browser: its usage policy requires an
// identifying User-Agent, which a browser fetch() can't set, so direct
// client calls were unreliable — that's what caused the delivery-location
// chip to keep falling back to a generic label instead of a real area name.
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Search is unavailable right now.");
  return (await res.json()) as PlaceResult[];
}

/** `accuracy` is the device's reported position error in metres: the server uses it to
 * decide how far around the point to look for a named place (a phone's GPS is
 * ~10 m, a laptop's Wi-Fi position can be hundreds of metres off). */
export async function reverseAreaName(lat: number, lng: number, accuracy?: number): Promise<string> {
  try {
    const acc = accuracy && Number.isFinite(accuracy) ? `&acc=${Math.round(accuracy)}` : "";
    const res = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}${acc}`);
    if (!res.ok) throw new Error();
    const data = (await res.json()) as { label: string | null };
    return data.label ?? "Current location";
  } catch {
    return "Current location";
  }
}
