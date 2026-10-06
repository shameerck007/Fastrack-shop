import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { TENANT_COOKIE, tenantHeaders } from "@/lib/tenant";
import { ADMIN_SCOPE_COOKIE, scopeHeaders } from "@/lib/platform-scope";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { ...tenantHeaders(cookieStore.get(TENANT_COOKIE)?.value), ...scopeHeaders(cookieStore.get(ADMIN_SCOPE_COOKIE)?.value) } },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore when
            // middleware is refreshing the session.
          }
        },
      },
    }
  );
}
