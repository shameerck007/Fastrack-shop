import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TENANT_COOKIE, tenantHeaders } from "@/lib/tenant";
import { ADMIN_SCOPE_COOKIE, PLATFORM_MARKET_COOKIE, scopeHeaders } from "@/lib/platform-scope";

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
  let response = NextResponse.next({ request });
  if (fromUrl) response.cookies.set(PLATFORM_MARKET_COOKIE, fromUrl, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

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
          if (fromUrl) response.cookies.set(PLATFORM_MARKET_COOKIE, fromUrl, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
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
