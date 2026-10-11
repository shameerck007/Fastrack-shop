"use server";



import { friendlyMessage } from "@/lib/errors";
import { failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface RiderEntryInput {
  riderId: string;
  kind: "payout" | "cash_deposit" | "salary" | "bonus" | "advance" | "deduction";
  amount: number;
  method: string;
  reference?: string;
  note?: string;
}

/** Admin records money paid to a rider, or cash a rider handed in. Returns an error value rather than throwing so the message survives production. */
export async function recordRiderSettlementEntry(input: RiderEntryInput): Promise<{ error?: string }> {
  try {
  if (!(input.amount > 0)) return await { error: "Enter an amount greater than zero." };
  if (!["payout", "cash_deposit", "salary", "bonus", "advance", "deduction"].includes(input.kind)) return await { error: "Choose what you are recording." };

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
  if (error) {
    if (/kind_check|violates check constraint/i.test(error.message)) return await { error: "Salary, bonus, advance and deduction entries need the latest database update (migration 0065). Run it, then try again." };
    return await { error: friendlyMessage(error) };
  }

  revalidatePath("/admin/rider-settlements");
  revalidatePath(`/admin/rider-settlements/${input.riderId}`);
  return await {};

  } catch (e) {
    return failure(e) as never;
  }
}
