import { NextResponse } from "next/server";

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

// Proxied server-side for the same reason as /api/geo/reverse: Nominatim
// expects an identifying User-Agent that a browser fetch() can't set.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json([]);

  try {
    const res = await fetch(
      "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=sa&accept-language=en&q=" +
        encodeURIComponent(q),
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "FasTrack Shop/1.0 (https://shop.fastrack.cloud)",
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
    const items = (await res.json()) as NominatimItem[];
    const results = items.map((i) => {
      const parts = i.display_name.split(",").map((p) => p.trim());
      return {
        label: i.name || parts[0],
        detail: parts.slice(1, 4).join(", "),
        lat: Number(i.lat),
        lng: Number(i.lon),
      };
    });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 502 });
  }
}
