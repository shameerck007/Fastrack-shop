// The default OpenStreetMap raster tiles label places in the local script
// (Arabic in Saudi Arabia). When a Stadia Maps key is configured
// (NEXT_PUBLIC_STADIAMAPS_KEY), we use their "OSM Bright" tiles instead —
// these label places in English AND render individual shops, businesses,
// building outlines and POI icons (close to Google Maps' level of detail).
// Falls back to MapTiler if that key is set instead, then to Esri's World
// Street Map tiles (free, no key, English labels, but no shop-level detail).
const STADIA_KEY = process.env.NEXT_PUBLIC_STADIAMAPS_KEY;
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

export const TILE_URL = STADIA_KEY
  ? `https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png?api_key=${STADIA_KEY}`
  : MAPTILER_KEY
    ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
    : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

export const TILE_OPTIONS = {
  attribution: STADIA_KEY
    ? '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
    : MAPTILER_KEY
      ? '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
      : "Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, (c) OpenStreetMap contributors, and the GIS User Community",
  maxZoom: STADIA_KEY || MAPTILER_KEY ? 20 : 19,
  tileSize: 256,
  detectRetina: !!STADIA_KEY,
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

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: Record<string, string>;
}

// OpenStreetMap's Nominatim geocoder (free; keep requests infrequent —
// callers debounce). Results are requested in English and biased to Saudi
// Arabia, where the app operates.
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=sa&accept-language=en&q=" +
    encodeURIComponent(q);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Search is unavailable right now.");
  const items = (await res.json()) as NominatimItem[];
  return items.map((i) => {
    const parts = i.display_name.split(",").map((p) => p.trim());
    return {
      label: i.name || parts[0],
      detail: parts.slice(1, 4).join(", "),
      lat: Number(i.lat),
      lng: Number(i.lon),
    };
  });
}

export async function reverseAreaName(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=en&lat=${lat}&lon=${lng}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    const a = data.address ?? {};
    return a.suburb || a.neighbourhood || a.city_district || a.quarter || a.city || a.town || "Selected location";
  } catch {
    return "Selected location";
  }
}
