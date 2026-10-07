"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SHOP_MODE_COOKIE } from "@/lib/landing";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(SHOP_MODE_COOKIE);
  redirect("/");
}

/** Resolves a login identifier (email or phone) to the account's email, so
 * the client can call signInWithPassword with it. Phone lookups happen
 * server-side via the service-role client — this is deliberately not a
 * public RPC, which would let anyone probe phone numbers to discover the
 * associated email. Returns null for "no such phone" and for any lookup
 * failure alike, so the caller can show one generic invalid-credentials
 * message regardless of why it failed. */
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return trimmed;

  try {
    const supabase = createServiceClient();
    const { data: profile } = await supabase.from("profiles").select("id").eq("phone", trimmed).maybeSingle();
    if (!profile) return null;

    const { data } = await supabase.auth.admin.getUserById(profile.id);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Does an account with this email exist? Lets the login screen say "no account with this email" up front instead of
 * asking for a password that can never work. Returns null when the check itself fails, so login still goes on to
 * the password step. Uses migration 0062's auth_email_exists() when present, else scans the user list.
 */
export async function emailHasAccount(email: string): Promise<boolean | null> {
  const wanted = email.trim().toLowerCase();
  if (!wanted || !wanted.includes("@")) return null;
  try {
    const supabase = createServiceClient();
    const rpc = await (supabase as unknown as { rpc: (fn: string, args: object) => Promise<{ data: unknown; error: { code?: string } | null }> }).rpc(
      "auth_email_exists",
      { target_email: wanted }
    );
    if (!rpc.error) return rpc.data === true;

    // Function not installed yet: page through the users (fine at this size; the SQL function is the faster path).
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return null;
      if (data.users.some((u) => u.email?.toLowerCase() === wanted)) return true;
      if (data.users.length < 1000) return false;
    }
    return null;
  } catch {
    return null;
  }
}
