"use server";



import { friendlyMessage } from "@/lib/errors";
import { failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface RiderPayInput {
  riderId: string;
  payType: "per_delivery" | "salary";
  monthlySalary?: number | null;
  /** Salary riders only: do deliveries earn the per-delivery pay on top of the salary? */
  deliveriesEarnExtra: boolean;
  /** The rider's app shows no earned amounts, balance, salary or statement. Cash to hand in stays visible. */
  hideEarnings: boolean;
  /** Daily-target bonus: follow the pay type (null), always, or never. */
  dailyBonus: boolean | null;
  /** Salary riders only: add the monthly salary by itself on this day (1 to 28). */
  autoSalary: boolean;
  salaryDay: number;
}

/** Sets how a rider is paid: per delivery, or a fixed monthly salary (optionally plus per-delivery pay). */
export async function updateRiderPay(input: RiderPayInput): Promise<{ error?: string }> {
  try {
  if (input.payType !== "per_delivery" && input.payType !== "salary") return await { error: "Choose how this rider is paid." };
  if (input.payType === "salary" && !(Number(input.monthlySalary) > 0)) return await { error: "Enter the monthly salary." };
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
      hide_earnings: !!input.hideEarnings,
      daily_bonus_override: input.dailyBonus,
      auto_salary: input.payType === "salary" ? !!input.autoSalary : false,
      salary_day: Math.min(28, Math.max(1, Math.round(Number(input.salaryDay) || 1))),
    })
    .eq("id", input.riderId)
    .select("id");
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") return await { error: "These pay options need the latest database update (migration 0095). Run it, then try again." };
    return await { error: friendlyMessage(error) };
  }
  if (!data || data.length === 0) return await { error: "Could not update this rider." };
  revalidatePath(`/admin/riders/${input.riderId}`);
  revalidatePath("/admin/rider-settlements");
  revalidatePath(`/admin/rider-settlements/${input.riderId}`);
  return await {};

  } catch (e) {
    return failure(e) as never;
  }
}
