import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/** The signed-in user, asked of the auth server once per request (layouts and pages share the answer). */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

const getProfileFor = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
});

export async function requireRole(role: Profile["role"]): Promise<Profile> {
  const user = await getSessionUser();

  if (!user) redirect("/login");

  const profile = await getProfileFor(user.id);

  // The platform owner (super_admin) can open everything a tenant admin can.
  const allowed = profile && (profile.role === role || (role === "admin" && profile.role === "super_admin"));
  if (!profile || !allowed) redirect("/");

  return profile;
}
