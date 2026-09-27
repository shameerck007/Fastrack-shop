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
async function fetchNominatim(lat: string, lng: string, timeoutMs: number) {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=en&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "FasTrack Shop/1.0 (https://shop.fastrack.cloud)",
      },
      signal: AbortSignal.timeout(timeoutMs),
    }
  );
}

function pickLabel(address: Record<string, string>): string | null {
  // Prefer a named area (stable, human-friendly); fall back through street,
  // then city/town/village, then the broader district/state so even a
  // sparse rural response still yields something better than coordinates.
  return (
    address.suburb ||
    address.neighbourhood ||
    address.city_district ||
    address.quarter ||
    address.road ||
    address.pedestrian ||
    address.city ||
    address.town ||
    address.village ||
    address.county ||
    address.state_district ||
    address.state ||
    null
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  for (const timeoutMs of [6000, 4000]) {
    try {
      const res = await fetchNominatim(lat, lng, timeoutMs);
      if (!res.ok) continue;
      const data = (await res.json()) as { address?: Record<string, string> };
      const label = pickLabel(data.address ?? {});
      if (label) {
        return NextResponse.json({ label }, { headers: { "Cache-Control": "public, max-age=300" } });
      }
    } catch {
      // try again with the next timeout, or fall through below
    }
  }

  return NextResponse.json({ label: null });
}
