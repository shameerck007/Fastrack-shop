import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TENANT_COOKIE, tenantHeaders } from "@/lib/tenant";
import { ADMIN_SCOPE_COOKIE, PLATFORM_MARKET_COOKIE, scopeHeaders } from "@/lib/platform-scope";

const YEAR = 60 * 60 * 24 * 365;

/** The active market for a visitor's country code (falls back to the default market). Null if the lookup fails. */
async function tenantForCountry(country: string | null): Promise<string | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenants?select=id,country_code,is_default&status=eq.active`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { id: string; country_code: string; is_default: boolean }[];
    const code = country?.toUpperCase();
    return (rows.find((t) => t.country_code === code) ?? rows.find((t) => t.is_default) ?? rows[0])?.id ?? null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  // Platform owner: /platform/<country>/... names the country being viewed (remembered in a cookie);
  // the admin screens are then limited to that country. Other roles ignore this, the database
  // only honours it for super_admin. Never trust an incoming scope cookie.
  const path = request.nextUrl.pathname;
  const fromUrl = path.match(/^\/platform\/([a-z]{2})(?:\/|$)/)?.[1];
  const remembered = fromUrl ?? request.cookies.get(PLATFORM_MARKET_COOKIE)?.value;
  const scope = path.startsWith("/admin") && remembered && /^[a-z]{2}$/.test(remembered) ? remembered : null;
  if (scope) request.cookies.set(ADMIN_SCOPE_COOKIE, scope);
  else request.cookies.delete(ADMIN_SCOPE_COOKIE);
  // First visit (no market chosen yet): open the market that matches the visitor's country, as
  // Cloudflare reports it. Everywhere else, or when nothing matches, the default market applies.
  // The visitor can still switch any time; once they have a cookie this never runs again.
  let autoTenant: string | null = null;
  if (request.method === "GET" && !request.cookies.get(TENANT_COOKIE) && !path.startsWith("/api/") && request.headers.get("accept")?.includes("text/html")) {
    autoTenant = await tenantForCountry(request.headers.get("cf-ipcountry"));
    if (autoTenant) request.cookies.set(TENANT_COOKIE, autoTenant);
  }
  const persist = (res: NextResponse) => {
    if (fromUrl) res.cookies.set(PLATFORM_MARKET_COOKIE, fromUrl, { path: "/", maxAge: YEAR, sameSite: "lax" });
    if (autoTenant) res.cookies.set(TENANT_COOKIE, autoTenant, { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: false });
  };
  let response = NextResponse.next({ request });
  persist(response);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { ...tenantHeaders(request.cookies.get(TENANT_COOKIE)?.value), ...scopeHeaders(scope) } },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          persist(response);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session so Server Components get a valid token.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
