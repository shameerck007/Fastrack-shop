import { NextResponse } from "next/server";

// "Nearby places" for the location screen (Keeta-style: when GPS is a little off,
// the shopper taps the building they're actually in). HERE Browse, nearest first.
// Server-side so the HERE key never reaches the browser.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }
  const key = process.env.HERE_API_KEY;
  if (!key) return NextResponse.json([]);

  const acc = Number(searchParams.get("acc"));
  const radius = Math.round(Math.min(Math.max(Number.isFinite(acc) && acc > 0 ? acc : 0, 150), 400));

  try {
    const res = await fetch(
      `https://browse.search.hereapi.com/v1/browse?at=${lat},${lng}&in=circle:${lat},${lng};r=${radius}&limit=20&lang=en&apiKey=${key}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return NextResponse.json([]);
    const data = (await res.json()) as {
      items?: {
        title?: string;
        distance?: number;
        position?: { lat: number; lng: number };
        address?: { district?: string; street?: string; city?: string };
      }[];
    };
    const seen = new Set<string>();
    const places = (data.items ?? [])
      .filter((i) => i.title && i.position && typeof i.distance === "number")
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
      .filter((i) => {
        const k = (i.title as string).toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 6)
      .map((i) => ({
        label: i.title as string,
        detail: [i.address?.street, i.address?.district].filter(Boolean).join(", ") || i.address?.city || "",
        lat: i.position!.lat,
        lng: i.position!.lng,
        distanceM: Math.round(i.distance as number),
      }));
    return NextResponse.json(places, { headers: { "Cache-Control": "public, max-age=120" } });
  } catch {
    return NextResponse.json([]);
  }
}
