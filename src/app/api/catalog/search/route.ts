import { NextResponse } from "next/server";
import { searchMasterCatalog } from "@/lib/master-catalog";

// Lightweight JSON for the catalog search box: one page of products and the total, nothing else.
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const status = u.get("status") === "pending" ? "pending" : "approved";
  const size = Math.min(60, Math.max(1, Number(u.get("size")) || 40));
  const result = await searchMasterCatalog({
    status,
    q: u.get("q") ?? undefined,
    categoryId: u.get("cat") ?? undefined,
    page: Math.max(1, Number(u.get("page")) || 1),
    pageSize: size,
    withOffers: u.get("offers") === "1",
  });
  if (!result || result.error) return NextResponse.json({ error: result?.error ?? "Catalog not available" }, { status: 500 });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
