import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { readTenantCookie, tenantHeaders } from "@/lib/tenant";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // The market the shopper chose; the database's tenant rules read this header.
    { global: { headers: tenantHeaders(readTenantCookie()) } }
  );
}
