import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/tenant-server";
import { marketGeo } from "@/lib/map-config";

interface PlaceOut {
  label: string;
  detail: string;
  lat: number;
  lng: number;
}

interface HereItem {
  title?: string;
  position?: { lat: number; lng: number };
  address?: { label?: string; district?: string; city?: string; state?: string; street?: string };
}

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

/** HERE: places and landmarks (Discover) plus addresses and areas (Geocode), limited to the market's country. */
async function hereSearch(q: string, key: string, iso3: string, at: [number, number]): Promise<PlaceOut[]> {
  const base = `q=${encodeURIComponent(q)}&in=countryCode:${iso3}&limit=6&lang=en&apiKey=${key}`;
  const [discover, geocode] = await Promise.all([
    fetch(`https://discover.search.hereapi.com/v1/discover?at=${at[0]},${at[1]}&${base}`, { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ items?: HereItem[] }>) : { items: [] }))
      .catch(() => ({ items: [] as HereItem[] })),
    fetch(`https://geocode.search.hereapi.com/v1/geocode?${base}`, { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ items?: HereItem[] }>) : { items: [] }))
      .catch(() => ({ items: [] as HereItem[] })),
  ]);
  const seen = new Set<string>();
  const out: PlaceOut[] = [];
  for (const i of [...(geocode.items ?? []), ...(discover.items ?? [])]) {
    if (!i.position || !i.title) continue;
    const key2 = `${i.position.lat.toFixed(3)},${i.position.lng.toFixed(3)}`;
    if (seen.has(key2)) continue;
    seen.add(key2);
    const a = i.address ?? {};
    out.push({
      label: i.title,
      detail: [a.district, a.city, a.state].filter(Boolean).join(", "),
      lat: i.position.lat,
      lng: i.position.lng,
    });
    if (out.length >= 6) break;
  }
  return out;
}

/** Free fallback (OpenStreetMap Nominatim), limited to the market's country. */
async function nominatimSearch(q: string, iso2: string): Promise<PlaceOut[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=${iso2.toLowerCase()}&accept-language=en&q=` +
      encodeURIComponent(q),
    {
      headers: { Accept: "application/json", "User-Agent": "FasTrack Shop/1.0 (https://shop.fastrack.cloud)" },
      signal: AbortSignal.timeout(6000),
    }
  );
  if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
  const items = (await res.json()) as NominatimItem[];
  return items.map((i) => {
    const parts = i.display_name.split(",").map((p) => p.trim());
    return { label: i.name || parts[0], detail: parts.slice(1, 4).join(", "), lat: Number(i.lat), lng: Number(i.lon) };
  });
}

// Proxied server-side so the HERE key stays private and Nominatim gets its required User-Agent.
// The search is limited to the country of the market being used (India for the India shop).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json([]);

  const country = (await getCurrentTenant().catch(() => null))?.country_code ?? "SA";
  const geo = marketGeo(country);
  const key = process.env.HERE_API_KEY;

  try {
    if (key) {
      const results = await hereSearch(q, key, geo.iso3, geo.center);
      if (results.length > 0) return NextResponse.json(results);
    }
    return NextResponse.json(await nominatimSearch(q, geo.iso2));
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 502 });
  }
}
