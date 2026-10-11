import { createClient } from "@/lib/supabase/server";

export interface PersonRow {
  id: string;
  name: string | null;
  role: string;
  phone_masked: string | null;
  email_masked: string | null;
  joined_at: string;
  blocked: boolean;
  store_id: string | null;
  store_name: string | null;
  store_status: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  /** Set when the account has a rider record (an applicant waiting for approval, or an approved rider). */
  rider_status?: string | null;
}

/** One page of accounts of one type (or all), with masked contact details. Null when migration 0076 is not in yet. */
export async function getPeople(opts: { role?: string; q?: string; page?: number; pageSize?: number }): Promise<{ items: PersonRow[]; total: number } | null | { error: string }> {
  const pageSize = opts.pageSize ?? 25;
  const page = Math.max(1, opts.page ?? 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_people" as never, { p_role: opts.role ?? "all", p_q: opts.q ?? null, p_limit: pageSize, p_offset: (page - 1) * pageSize } as never);
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") return null;
    return { error: error.message };
  }
  const d = data as unknown as { total: number; items: PersonRow[] };
  return { items: d.items ?? [], total: Number(d.total ?? 0) };
}

export async function getPeopleCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_people_counts" as never);
  if (error || !data) return {};
  return data as unknown as Record<string, number>;
}
