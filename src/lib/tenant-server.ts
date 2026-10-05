import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CURRENCY, moneyFor, type MoneyFormatter } from "@/lib/money";
import { TENANT_COOKIE, TENANT_SUGGESTION_COOKIE, isTenantId, type Tenant } from "@/lib/tenant";

/** Active markets (tenants). The table is publicly readable; empty if migration 0044 hasn't run. */
export async function getActiveTenants(): Promise<Tenant[]> {
  const supabase = await createClient();
  const loose = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: Tenant[] | null; error: unknown }> };
    };
  };
  const { data, error } = await loose.from("tenants").select("id, slug, name, country_code, currency, is_default").eq("status", "active");
  if (error || !data) return [];
  return data;
}

/** The market this request is working in. Asks the database (same rule the security policies use):
 * staff are pinned to their own tenant, shoppers get the market they chose, else the default. */
export async function getCurrentTenant(): Promise<Tenant | null> {
  const tenants = await getActiveTenants();
  if (tenants.length === 0) return null;
  const supabase = await createClient();
  const { data: dbTenantId } = await supabase.rpc("current_tenant_id" as never);
  const fromDb = typeof dbTenantId === "string" ? tenants.find((t) => t.id === dbTenantId) : undefined;
  if (fromDb) return fromDb;
  const chosen = (await cookies()).get(TENANT_COOKIE)?.value;
  return (isTenantId(chosen) ? tenants.find((t) => t.id === chosen) : undefined) ?? tenants.find((t) => t.is_default) ?? tenants[0];
}

/** Suggest the market matching the visitor's country (Cloudflare's own header), if it differs from the current one.
 * Only a suggestion — the customer decides — and never repeated once they have answered. */
export async function getMarketSuggestion(): Promise<{ current: Tenant; suggested: Tenant } | null> {
  const store = await cookies();
  if (store.get(TENANT_SUGGESTION_COOKIE)) return null;
  const tenants = await getActiveTenants();
  if (tenants.length < 2) return null;
  const country = (await headers()).get("cf-ipcountry")?.toUpperCase();
  if (!country) return null;
  const chosen = store.get(TENANT_COOKIE)?.value;
  const current = (isTenantId(chosen) ? tenants.find((t) => t.id === chosen) : undefined) ?? tenants.find((t) => t.is_default) ?? tenants[0];
  const suggested = tenants.find((t) => t.country_code === country);
  if (!suggested || suggested.id === current.id) return null;
  return { current, suggested };
}

/** The current market's currency, falling back to SAR before the tenant tables exist. */
export async function getCurrency(): Promise<string> {
  return (await getCurrentTenant().catch(() => null))?.currency ?? DEFAULT_CURRENCY;
}

/** Server-side money formatter for the current market: `const money = await getMoney(); money(12.5)`. */
export async function getMoney(): Promise<MoneyFormatter> {
  return moneyFor(await getCurrency());
}
