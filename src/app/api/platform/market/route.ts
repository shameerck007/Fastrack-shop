import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLATFORM_MARKET_COOKIE } from "@/lib/platform";

/** Remembers which market the platform owner is looking at, then returns to the page they were on. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  if (profile?.role !== "super_admin") return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const slug = url.searchParams.get("slug") ?? "";
  const next = url.searchParams.get("next") ?? "/platform";
  const target = next.startsWith("/platform") && !next.startsWith("//") ? next : "/platform";
  const res = NextResponse.redirect(new URL(target, url.origin));
  if (/^[a-z0-9-]{1,60}$/.test(slug)) res.cookies.set(PLATFORM_MARKET_COOKIE, slug, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
