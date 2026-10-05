// Map tiles served through our own server so the HERE key stays a server-side secret
// (a browser tile URL would expose it). Cloudflare caches each tile at the edge for a
// day, which keeps repeat views from counting against HERE's free allowance.
// If HERE is unavailable (no key, quota, outage) it falls back to Esri's free street
// tiles so a map is never blank.
const DAY = 60 * 60 * 24;

async function fetchTile(url: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    // Workers-only cache hint; ignored by other runtimes.
    cf: { cacheTtl: DAY, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) throw new Error(`tile ${res.status}`);
  return res;
}

export async function GET(_request: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z, x, y } = await params;
  if (![z, x, y].every((p) => /^\d{1,7}$/.test(p)) || Number(z) > 20) {
    return new Response("bad tile", { status: 400 });
  }

  const key = process.env.HERE_API_KEY;
  const sources: string[] = [];
  if (key) sources.push(`https://maps.hereapi.com/v3/base/mc/${z}/${x}/${y}/png8?style=explore.day&lang=en&size=256&apiKey=${key}`);
  sources.push(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`);

  for (const url of sources) {
    try {
      const upstream = await fetchTile(url);
      return new Response(upstream.body, {
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
          "Cache-Control": `public, max-age=${DAY}, s-maxage=${DAY}`,
        },
      });
    } catch {
      // try the next source
    }
  }
  return new Response("tile unavailable", { status: 502 });
}
