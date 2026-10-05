"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_COOKIE, TENANT_SUGGESTION_COOKIE } from "@/lib/tenant";
import { getActiveTenants } from "@/lib/tenant-server";

const YEAR = 60 * 60 * 24 * 365;

/** Switch the market the visitor is shopping in. Only active tenants can be chosen. */
export async function setMarket(tenantId: string): Promise<{ error?: string }> {
  const tenants = await getActiveTenants();
  if (!tenants.some((t) => t.id === tenantId)) return { error: "That market isn't available." };
  const store = await cookies();
  // Readable by the browser on purpose: the browser Supabase client sends it as the tenant header.
  store.set(TENANT_COOKIE, tenantId, { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: false });
  store.set(TENANT_SUGGESTION_COOKIE, "1", { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
  return {};
}

/** The visitor said no to the "switch to your country's shop" suggestion; don't ask again. */
export async function dismissMarketSuggestion(): Promise<void> {
  (await cookies()).set(TENANT_SUGGESTION_COOKIE, "1", { path: "/", maxAge: YEAR, sameSite: "lax" });
}
