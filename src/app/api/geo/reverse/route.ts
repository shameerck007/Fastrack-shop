import { NextResponse } from "next/server";

// Proxied server-side rather than called from the browser: Nominatim's usage
// policy requires an identifying User-Agent (which fetch() in a browser
// can't set), so direct client calls get silently rate-limited/blocked,
// which is why the delivery-location chip kept falling back to a generic
// "Selected location" label instead of the shopper's actual area.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=en&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "FasTrack Shop/1.0 (https://shop.fastrack.cloud)",
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
    const data = (await res.json()) as { address?: Record<string, string> };
    const a = data.address ?? {};
    // Prefer a named area (stable, human-friendly); if the point is too rural/
    // new for one, fall back to the street name rather than coordinates.
    const area = a.suburb || a.neighbourhood || a.city_district || a.quarter || null;
    const street = a.road || a.pedestrian || null;
    const cityLevel = a.city || a.town || a.village || null;
    const label = area || street || cityLevel || null;
    return NextResponse.json({ label }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return NextResponse.json({ label: null });
  }
}
