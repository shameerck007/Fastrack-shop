// Which country the platform owner (super_admin) is working in. The address /platform/<country>
// decides it (middleware remembers it in PLATFORM_MARKET_COOKIE); on the /admin screens the
// middleware copies it into ADMIN_SCOPE_COOKIE for that one request, and it is sent to the database
// as the `x-platform-country` header. The database only honours it for super_admin (migration 0056),
// so for every other role this changes nothing.

export const PLATFORM_MARKET_COOKIE = "fs_platform_market";
export const ADMIN_SCOPE_COOKIE = "fs_admin_scope";

/** Header for Supabase requests; empty when no country scope applies. */
export function scopeHeaders(country: string | null | undefined): Record<string, string> {
  return country && /^[a-z]{2}$/i.test(country) ? { "x-platform-country": country.toUpperCase() } : {};
}
