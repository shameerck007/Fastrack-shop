import { NextResponse } from "next/server";

// Proxied server-side rather than called from the browser: Nominatim's usage
// policy requires an identifying User-Agent (which fetch() in a browser
// can't set), so direct client calls get silently rate-limited/blocked,
// which is why the delivery-location chip kept falling back to a generic
// "Selected location" label instead of the shopper's actual area.
//
// Cloudflare Workers share outbound IP ranges across many sites, which
// Nominatim's free tier occasionally rate-limits — that shows up as an
// intermittent failure for one request that would succeed a moment later.
// One retry absorbs that without the shopper ever seeing it.
async function fetchNominatim(lat: string, lng: string, zoom: number, timeoutMs: number) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=${zoom}&accept-language=en&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "FasTrack Shop/1.0 (https://shop.fastrack.cloud)",
      },
      signal: AbortSignal.timeout(timeoutMs),
    }
  );
  if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
  return (await res.json()) as { name?: string; category?: string; address?: Record<string, string> };
}

// Amazon/Instamart-style "street, area" rather than one bare field. Sparse
// areas (industrial zones, new developments) often carry only one of these,
// or neither in the structured address fields — hence the coarser-zoom
// retry below, which is more likely to match a named polygon (e.g. an
// industrial city) instead of an empty nearby road segment.
function buildLabel(data: { name?: string; category?: string; address?: Record<string, string> }, zoom: number): string | null {
  const a = data.address ?? {};
  const street = a.road || a.pedestrian || null;
  const area = a.suburb || a.neighbourhood || a.city_district || a.quarter || a.city_block || a.municipality || null;
  // Building-level lookup: when the spot is a named place (an office, shop,
  // landmark...) lead with that name — "Obeikan Group, Al Olaya" — instead
  // of just the street, which is how Keeta/Uber label where you are.
  const isNamedPlace =
    zoom >= 18 && !!data.name && !/^(no\.?\s*)?[\d\s\-\/]+$/i.test(data.name) && !["highway", "boundary", "place", "landuse"].includes(data.category ?? "");
  if (isNamedPlace && data.name !== street && data.name !== area) {
    const where = area || street;
    return where ? `${data.name}, ${where}` : (data.name as string);
  }
  if (street && area && street !== area) return `${street}, ${area}`;
  if (street) return street;
  if (area) return area;
  if (data.name) return data.name;
  return a.city || a.town || a.village || a.county || a.state_district || a.state || null;
}

// Venue-level lookup via Stadia's geocoder (Foursquare-backed POIs), which
// knows business names like "Obeikan" where OpenStreetMap often has nothing
// at the exact spot — this is what lets the header say where the shopper
// actually is instead of just "Riyadh Governorate". Only a venue within
// 60 m counts, so a GPS fix doesn't get labelled with a place down the road.
const STADIA_KEY = process.env.NEXT_PUBLIC_STADIAMAPS_KEY;

async function venueLabel(lat: string, lng: string): Promise<string | null> {
  if (!STADIA_KEY) return null;
  try {
    const res = await fetch(
      `https://api.stadiamaps.com/geocoding/v1/reverse?point.lat=${encodeURIComponent(lat)}&point.lon=${encodeURIComponent(lng)}&layers=venue&size=3&boundary.circle.radius=1&api_key=${STADIA_KEY}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { properties?: { name?: string; distance?: number; neighbourhood?: string; locality?: string } }[];
    };
    const best = data.features?.find((f) => (f.properties?.distance ?? Infinity) <= 0.06 && f.properties?.name);
    if (!best?.properties?.name) return null;
    // Names often come bilingual as "العبيكان | Obeikan" — the English half reads
    // better in the header; keep the Arabic one when it's all there is.
    const parts = best.properties.name.split("|").map((p) => p.trim()).filter(Boolean);
    const name = parts.find((p) => /[A-Za-z]/.test(p)) ?? parts[0];
    const area = best.properties.neighbourhood || best.properties.locality;
    return area ? `${name}, ${area}` : name;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const venue = await venueLabel(lat, lng);
  if (venue) {
    return NextResponse.json({ label: venue }, { headers: { "Cache-Control": "public, max-age=300" } });
  }

  // Fine zoom first (street-level); a coarser zoom as a second attempt picks
  // up named areas (e.g. an industrial city) when the fine-grained lookup
  // has nothing better than a country/region name to offer.
  for (const zoom of [18, 16, 12]) {
    for (const timeoutMs of [6000, 4000]) {
      try {
        const data = await fetchNominatim(lat, lng, zoom, timeoutMs);
        const label = buildLabel(data, zoom);
        if (label) {
          return NextResponse.json({ label }, { headers: { "Cache-Control": "public, max-age=300" } });
        }
        break; // got a response but nothing usable — try the next zoom, not the same zoom again
      } catch {
        // try again (shorter timeout), then fall through to the next zoom
      }
    }
  }

  return NextResponse.json({ label: null });
}
