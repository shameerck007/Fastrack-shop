import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Only ever import this from
// a "use server" file (Server Actions, Route Handlers) — never from a
// client component.
//
// The one thing this is used for: resolving a phone number to its
// account email during phone+password sign-in. Phone isn't a verified
// Supabase Auth identity here (no SMS provider configured), so there's
// no RLS-safe way to look up "whose account is this phone" before the
// visitor is signed in — a public RPC for that would let anyone probe
// phone numbers to discover the associated email, so the lookup has to
// happen behind the service role instead, server-side only.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
