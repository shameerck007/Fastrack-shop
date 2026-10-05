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
