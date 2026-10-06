"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Loose = {
  from: (t: string) => {
    update: (row: object) => { eq: (c: string, v: string) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } };
    insert: (row: object) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string; code?: string } | null }> } };
  };
};

async function requirePlatformOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Please sign in again." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { supabase, error: "Only the platform owner can do this." };
  return { supabase, error: null as string | null };
}

/** Open a market to customers (active), hide it (draft) or pause it (suspended). */
export async function setTenantStatus(tenantId: string, status: "draft" | "active" | "suspended"): Promise<{ error?: string }> {
  if (!["draft", "active", "suspended"].includes(status)) return { error: "Unknown status." };
  const { supabase, error } = await requirePlatformOwner();
  if (error) return { error };
  const db = supabase as unknown as Loose;
  const res = await db.from("tenants").update({ status }).eq("id", tenantId).select("id");
  if (res.error) return { error: res.error.message };
  if (!res.data || res.data.length === 0) return { error: "Market not found." };
  revalidatePath("/platform");
  revalidatePath("/platform/markets");
  return {};
}

/** Create a new market (a draft, so nothing is public until the owner opens it). */
export async function createTenant(input: { name: string; slug: string; countryCode: string }): Promise<{ error?: string }> {
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  if (!name) return { error: "Enter the market name." };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { error: "The short name can only use lowercase letters, numbers and dashes." };
  const { supabase, error } = await requirePlatformOwner();
  if (error) return { error };

  const { data: country } = await supabase
    .from("countries" as never)
    .select("code, currency")
    .eq("code", input.countryCode)
    .maybeSingle();
  const c = country as unknown as { code: string; currency: string } | null;
  if (!c) return { error: "Choose a country." };

  const db = supabase as unknown as Loose;
  const created = await db.from("tenants").insert({ name, slug, country_code: c.code, currency: c.currency, status: "draft" }).select("id").single();
  if (created.error || !created.data) {
    return { error: created.error?.code === "23505" ? "A market with that short name already exists." : (created.error?.message ?? "Could not create the market.") };
  }
  // Every market needs its own business-details row (name, tax number, address) for invoices.
  await db.from("company_settings").insert({ tenant_id: created.data.id, trading_name: name }).select("id").single();
  revalidatePath("/platform/markets");
  return {};
}
