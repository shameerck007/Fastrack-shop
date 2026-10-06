import { NextResponse } from "next/server";
import { getStoreDirectory } from "@/lib/stores";

// Public storefront info (name, logo, hours, paused) for every approved
// store, fetched once by the client so product cards can show the supplier's
// logo and a Closed state without each page joining it in.
export async function GET() {
  const stores = await getStoreDirectory();
  return NextResponse.json(stores, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
