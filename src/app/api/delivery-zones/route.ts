import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Public: one row per approved store (its warehouse's centre + radius) plus a
// storeId-null row for FasTrack's own products. The browser uses this to tell
// shoppers what can be delivered to their location.
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_delivery_zones");
  if (error) return NextResponse.json({ error: "Could not load delivery zones" }, { status: 500 });

  const rows = ((data ?? []) as { store_id: string | null; lat: number | null; lng: number | null; radius_km: number | null }[]).map(
    (r) => ({
      storeId: r.store_id,
      lat: r.lat,
      lng: r.lng,
      radiusKm: r.radius_km == null ? null : Number(r.radius_km),
    })
  );

  return NextResponse.json(rows, { headers: { "Cache-Control": "public, max-age=30" } });
}
