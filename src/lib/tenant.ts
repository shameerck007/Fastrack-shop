// Which market (tenant) a visitor is shopping in. The choice lives in a cookie and is sent to
// the database on every request as the `x-tenant-id` header, which the row-level-security
// rules read (see migration 0044). Staff accounts are pinned to their own tenant in the
// database, so this header can never move them into another tenant.

export const TENANT_COOKIE = "fs_tenant";
/** Set once the visitor dismisses (or accepts) the "switch to your country's shop" suggestion. */
export const TENANT_SUGGESTION_COOKIE = "fs_tenant_seen";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTenantId(value: string | null | undefined): value is string {
  return !!value && UUID.test(value);
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  country_code: string;
  currency: string;
  is_default: boolean;
}

/** Header to attach to Supabase requests; empty when no market has been chosen. */
export function tenantHeaders(tenantId: string | null | undefined): Record<string, string> {
  return isTenantId(tenantId) ? { "x-tenant-id": tenantId } : {};
}

/** Browser-side read of the chosen market (the cookie is not httpOnly on purpose). */
export function readTenantCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${TENANT_COOKIE}=`));
  const value = match ? decodeURIComponent(match.slice(TENANT_COOKIE.length + 1)) : null;
  return isTenantId(value) ? value : null;
}
