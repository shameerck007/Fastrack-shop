import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export async function requireRole(role: Profile["role"]): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // The platform owner (super_admin) can open everything a tenant admin can.
  const allowed = profile && (profile.role === role || (role === "admin" && profile.role === "super_admin"));
  if (!profile || !allowed) redirect("/");

  return profile;
}
