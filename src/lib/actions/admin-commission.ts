"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant-server";

const MISSING = "Commission rules need database migration 0079. Run it in the Supabase SQL editor, then try again.";
const validRate = (r: number) => Number.isFinite(r) && r >= 0 && r <= 100;

type Loose = {
  from: (t: string) => {
    insert: (r: object) => Promise<{ error: { code?: string; message: string } | null }>;
    update: (r: object) => { eq: (c: string, v: string) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { code?: string; message: string } | null }> } };
    delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  };
};

/** The rate used when nothing more specific applies and the supplier has none of its own. */
export async function saveDefaultCommission(rate: number): Promise<{ error?: string }> {
  if (!validRate(rate)) return { error: "Enter a rate between 0 and 100." };
  const tenant = await getCurrentTenant();
  if (!tenant) return { error: "No market selected." };
  const supabase = await createClient();
  const { error } = await supabase.from("company_settings").update({ default_commission_rate: rate } as never).eq("tenant_id", tenant.id);
  if (error) return { error: error.code === "42703" || error.code === "PGRST204" ? MISSING : error.message };
  revalidatePath("/admin/commission");
  return {};
}

/** Sets (or clears, with null) the rate for a category; sub-categories without their own rate inherit it. */
export async function saveCategoryRate(categoryId: string, rate: number | null): Promise<{ error?: string }> {
  if (rate !== null && !validRate(rate)) return { error: "Enter a rate between 0 and 100." };
  // The commission tables are not in the generated types until the migration is in.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;
  const existing = await db.from("commission_rules").select("id").eq("category_id", categoryId).is("store_id", null).is("master_id", null);
  if (existing.error) return { error: existing.error.code === "42P01" ? MISSING : existing.error.message };
  const ids: string[] = (existing.data ?? []).map((r: { id: string }) => r.id);
  if (rate === null) {
    for (const id of ids) await db.from("commission_rules").delete().eq("id", id);
  } else if (ids.length > 0) {
    const { error } = await db.from("commission_rules").update({ rate, is_active: true, starts_on: null, ends_on: null }).eq("id", ids[0]);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("commission_rules").insert({ category_id: categoryId, rate });
    if (error) return { error: error.message };
  }
  revalidatePath("/admin/commission");
  return {};
}

/** Saves several category rates at once (null clears a rate). Stops at the first problem and says which category it was. */
export async function saveCategoryRates(items: { categoryId: string; rate: number | null }[]): Promise<{ error?: string; saved?: number }> {
  let saved = 0;
  for (const it of items) {
    const res = await saveCategoryRate(it.categoryId, it.rate);
    if (res.error) return { error: res.error, saved };
    saved++;
  }
  return { saved };
}

/** An exception for one supplier (optionally only for a category), with optional dates. */
export async function addCommissionException(input: { storeId: string; categoryId: string | null; rate: number; startsOn?: string; endsOn?: string; note?: string }): Promise<{ error?: string }> {
  if (!validRate(input.rate)) return { error: "Enter a rate between 0 and 100." };
  if (!input.storeId) return { error: "Choose a supplier." };
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) return { error: "The end date is before the start date." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await (supabase as unknown as Loose).from("commission_rules").insert({
    store_id: input.storeId,
    category_id: input.categoryId || null,
    rate: input.rate,
    starts_on: input.startsOn || null,
    ends_on: input.endsOn || null,
    note: input.note?.trim() || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.code === "42P01" ? MISSING : error.message };
  revalidatePath("/admin/commission");
  return {};
}

export async function deleteCommissionRule(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await (supabase as unknown as Loose).from("commission_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/commission");
  return {};
}

/** What commission would apply to a sale: the same rule order the database uses when an order is placed. */
export async function previewCommission(input: { storeId: string; categoryId: string | null; price: number }): Promise<{ error?: string; rate?: number; commission?: number; supplierGets?: number }> {
  if (!input.storeId) return { error: "Choose a supplier." };
  if (!(input.price >= 0)) return { error: "Enter a price." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commission_rate_for" as never, { p_store: input.storeId, p_category: input.categoryId || null, p_master: null, p_on: new Date().toISOString().slice(0, 10) } as never);
  if (error) return { error: error.code === "42883" || error.code === "PGRST202" ? MISSING : error.message };
  const rate = Number(data);
  const commission = Math.round(input.price * rate) / 100;
  return { rate, commission, supplierGets: Math.round((input.price - commission) * 100) / 100 };
}
