"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface RiderPayInput {
  riderId: string;
  payType: "per_delivery" | "salary";
  monthlySalary?: number | null;
  /** Salary riders only: do deliveries earn the per-delivery pay on top of the salary? */
  deliveriesEarnExtra: boolean;
}

/** Sets how a rider is paid: per delivery, or a fixed monthly salary (optionally plus per-delivery pay). */
export async function updateRiderPay(input: RiderPayInput): Promise<{ error?: string }> {
  if (input.payType !== "per_delivery" && input.payType !== "salary") return { error: "Choose how this rider is paid." };
  if (input.payType === "salary" && !(Number(input.monthlySalary) > 0)) return { error: "Enter the monthly salary." };
  const supabase = await createClient();
  const loose = supabase as unknown as {
    from: (t: string) => { update: (row: object) => { eq: (c: string, v: string) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string; code?: string } | null }> } } };
  };
  const { data, error } = await loose
    .from("delivery_partners")
    .update({
      pay_type: input.payType,
      monthly_salary: input.payType === "salary" ? Number(input.monthlySalary) : null,
      deliveries_earn_extra: input.payType === "salary" ? input.deliveriesEarnExtra : false,
    })
    .eq("id", input.riderId)
    .select("id");
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") return { error: "Salary pay needs the latest database update (migration 0065). Run it, then try again." };
    return { error: error.message };
  }
  if (!data || data.length === 0) return { error: "Could not update this rider." };
  revalidatePath(`/admin/riders/${input.riderId}`);
  revalidatePath("/admin/rider-settlements");
  revalidatePath(`/admin/rider-settlements/${input.riderId}`);
  return {};
}
