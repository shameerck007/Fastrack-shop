import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  // Escape PostgREST filter syntax characters so the raw query can't alter the .or() clause.
  const safe = q.replace(/[%,()]/g, "").trim();
  if (safe.length < 2) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, image_url, category:categories(slug), product_variants(price, is_default)")
    .eq("is_active", true)
    .or(`name.ilike.%${safe}%,name_ar.ilike.%${safe}%,brand.ilike.%${safe}%`)
    .limit(6);

  if (error) return NextResponse.json({ results: [] }, { status: 500 });

  const results = (data ?? []).map((p) => {
    const variants = p.product_variants as unknown as { price: number; is_default: boolean }[];
    const variant = variants.find((v) => v.is_default) ?? variants[0];
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      image_url: p.image_url,
      price: variant?.price ?? null,
    };
  });

  return NextResponse.json({ results });
}
