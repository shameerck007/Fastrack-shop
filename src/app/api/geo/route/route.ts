import { NextResponse } from "next/server";

// Road route + travel time for the live tracking map (HERE Routing v8, scooter mode).
// Server-side so the key stays secret. Returns the polyline already decoded to
// [lat, lng] pairs, so the browser needs no HERE-specific code.

function decodeChar(c: string): number {
  const code = c.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 71;
  if (code >= 48 && code <= 57) return code + 4;
  if (c === "-") return 62;
  if (c === "_") return 63;
  throw new Error("bad polyline");
}

/** HERE "flexible polyline" decoder (https://github.com/heremaps/flexible-polyline). */
function decodeFlexible(encoded: string): [number, number][] {
  let i = 0;
  const readUnsigned = (): number => {
    let result = 0;
    let shift = 0;
    for (;;) {
      const v = decodeChar(encoded[i++]);
      result += (v & 0x1f) * 2 ** shift;
      if ((v & 0x20) === 0) return result;
      shift += 5;
    }
  };
  const toSigned = (n: number) => (n % 2 === 1 ? -(n - 1) / 2 - 1 : n / 2);

  readUnsigned(); // format version
  const header = readUnsigned();
  const precision = header & 15;
  const thirdDim = (header >> 4) & 7;
  const factor = 10 ** precision;

  const points: [number, number][] = [];
  let lat = 0;
  let lng = 0;
  while (i < encoded.length) {
    lat += toSigned(readUnsigned());
    lng += toSigned(readUnsigned());
    if (thirdDim) readUnsigned();
    points.push([lat / factor, lng / factor]);
  }
  return points;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = process.env.HERE_API_KEY;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const coord = /^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;
  if (!key || !coord.test(from) || !coord.test(to)) return NextResponse.json({ points: [] });

  try {
    const res = await fetch(
      `https://router.hereapi.com/v8/routes?transportMode=scooter&origin=${from}&destination=${to}&return=polyline,summary&apiKey=${key}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return NextResponse.json({ points: [] });
    const data = (await res.json()) as {
      routes?: { sections?: { polyline?: string; summary?: { duration?: number; length?: number } }[] }[];
    };
    const sections = data.routes?.[0]?.sections ?? [];
    const points = sections.flatMap((s) => (s.polyline ? decodeFlexible(s.polyline) : []));
    const durationSec = sections.reduce((n, s) => n + (s.summary?.duration ?? 0), 0);
    const lengthM = sections.reduce((n, s) => n + (s.summary?.length ?? 0), 0);
    return NextResponse.json({ points, durationSec, lengthM }, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch {
    return NextResponse.json({ points: [] });
  }
}
