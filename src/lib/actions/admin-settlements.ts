"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface RecordPayoutInput {
  storeId: string;
  amount: number;
  method: string;
  reference?: string;
  note?: string;
}

/** Admin marks a payout as made to a merchant — RLS ("admins manage settlement payouts") is the real authorization boundary. */
export async function recordSettlementPayout(input: RecordPayoutInput) {
  if (!(input.amount > 0)) throw new Error("Enter a payout amount greater than zero.");

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
}
