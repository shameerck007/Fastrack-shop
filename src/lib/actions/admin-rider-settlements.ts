"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface RiderEntryInput {
  riderId: string;
  kind: "payout" | "cash_deposit";
  amount: number;
  method: string;
  reference?: string;
  note?: string;
}

/** Admin records money paid to a rider, or cash a rider handed in. Returns an error value rather than throwing so the message survives production. */
export async function recordRiderSettlementEntry(input: RiderEntryInput): Promise<{ error?: string }> {
  if (!(input.amount > 0)) return { error: "Enter an amount greater than zero." };
  if (input.kind !== "payout" && input.kind !== "cash_deposit") return { error: "Choose payout or cash deposit." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Table arrives with migration 0041, not in the generated types; RLS ("admins manage rider settlement entries") is the real gate.
  const loose = supabase as unknown as {
    from: (t: string) => { insert: (row: object) => Promise<{ error: { message: string } | null }> };
  };
  const { error } = await loose.from("rider_settlement_entries").insert({
    rider_id: input.riderId,
    kind: input.kind,
    amount: input.amount,
    method: input.method || "cash",
    reference: input.reference?.trim() || null,
    note: input.note?.trim() || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/rider-settlements");
  revalidatePath(`/admin/rider-settlements/${input.riderId}`);
  return {};
}
