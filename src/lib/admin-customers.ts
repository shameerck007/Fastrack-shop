import { createClient } from "@/lib/supabase/server";

export interface CustomerRow {
  id: string;
  name: string | null;
  phone_masked: string | null;
  email_masked: string | null;
  city: string | null;
  orders: number;
  spent: number;
  last_order_at: string | null;
  joined_at: string;
  blocked: boolean;
}

export interface CustomerDetail {
  id: string;
  name: string | null;
  joined_at: string;
  phone_masked: string | null;
  email_masked: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  /** True for the platform super admin: they may reveal the full phone and email. */
  can_reveal: boolean;
  stats: { orders: number; delivered: number; cancelled: number; spent: number; last_order_at: string | null };
  addresses: { id: string; label: string; address_line: string; city: string; district?: string | null; building_number?: string | null; unit_number?: string | null; postal_code?: string | null; is_default: boolean }[];
  orders: { id: string; order_number: string; status: string; total: number; currency: string | null; created_at: string }[];
  notes: { id: string; body: string; author: string; created_at: string }[];
  /** Only for the platform super admin. */
  access_log: { action: string; actor: string; created_at: string }[] | null;
}


/** One page of customers (contact details come back masked). Null when the customer tools are not in the database yet. */
export async function getCustomers(opts: { q?: string; filter?: string; page?: number; pageSize?: number }): Promise<{ items: CustomerRow[]; total: number } | null | { error: string }> {
  const pageSize = opts.pageSize ?? 25;
  const page = Math.max(1, opts.page ?? 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_customers" as never, { p_q: opts.q ?? null, p_filter: opts.filter ?? "all", p_limit: pageSize, p_offset: (page - 1) * pageSize } as never);
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") return null;
    return { error: error.message };
  }
  const d = data as unknown as { total: number; items: CustomerRow[] };
  return { items: d.items ?? [], total: Number(d.total ?? 0) };
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_customer_detail" as never, { p_id: id } as never);
  if (error || !data) return null;
  return data as unknown as CustomerDetail;
}
