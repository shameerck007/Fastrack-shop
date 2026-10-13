"use server";


import { UserError, failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface PayoutSheetRow {
  supplier: string;
  balanceDue: number;
  holder: string;
  bank: string;
  account: string;
  ifsc: string;
  phone: string;
}

/** The suppliers FasTrack owes money to, with their bank details, ready to hand to whoever makes the transfers. Admin only (row security). */
export async function exportPayoutSheet(): Promise<PayoutSheetRow[]> {
  try {
    const supabase = await createClient();
    const { data: overview, error } = await supabase.rpc("admin_settlement_overview");
    if (error) throw error;
    const owed = ((overview ?? []) as { store_id: string; store_name: string; balance_due: number }[]).filter((r) => Number(r.balance_due) > 0.005);
    if (owed.length === 0) return [];
    const { data: stores, error: sErr } = await supabase
      .from("stores")
      .select("id, bank_name, bank_iban, bank_account_number, bank_ifsc, bank_account_holder, contact_phone")
      .in("id", owed.map((o) => o.store_id));
    if (sErr) throw sErr;
    const byId = new Map(((stores ?? []) as { id: string; bank_name: string | null; bank_iban: string | null; bank_account_number: string | null; bank_ifsc: string | null; bank_account_holder: string | null; contact_phone: string | null }[]).map((s) => [s.id, s]));
    return owed
      .map((o) => {
        const s = byId.get(o.store_id);
        return { supplier: o.store_name, balanceDue: Number(o.balance_due), holder: s?.bank_account_holder ?? "", bank: s?.bank_name ?? "", account: s?.bank_iban || s?.bank_account_number || "", ifsc: s?.bank_ifsc ?? "", phone: s?.contact_phone ?? "" };
      })
      .sort((a, b) => b.balanceDue - a.balanceDue);
  } catch (e) {
    return failure(e) as never;
  }
}

export interface RecordPayoutInput {
  storeId: string;
  amount: number;
  method: string;
  reference?: string;
  note?: string;
}

/** Admin marks a payout as made to a merchant — RLS ("admins manage settlement payouts") is the real authorization boundary. */
export async function recordSettlementPayout(input: RecordPayoutInput) {
  try {
  if (!(input.amount > 0)) throw new UserError("Enter a payout amount greater than zero.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("settlement_payouts").insert({
    store_id: input.storeId,
    amount: input.amount,
    method: input.method || "bank_transfer",
    reference: input.reference?.trim() || null,
    note: input.note?.trim() || null,
    created_by: user?.id ?? null,
  });
  if (error) throw error;

  revalidatePath("/admin/settlements");
  revalidatePath(`/admin/settlements/${input.storeId}`);
  revalidatePath("/merchant/settlements");

  } catch (e) {
    return failure(e) as never;
  }
}
