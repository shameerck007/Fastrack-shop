"use server";

import { UserError, failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MIGRATION = "Return settings need the latest database update (migration 0098). Run it, then try again.";

/** Admin: the market's default return period (days from delivery, 0 = no returns) and whether defect returns with a photo are approved at once. */
export async function updateReturnSettings(input: { defaultWindowDays: number; autoApprove: boolean }): Promise<void> {
  try {
    const days = Math.round(Number(input.defaultWindowDays));
    if (!(days >= 0 && days <= 90)) throw new UserError("The return period must be between 0 and 90 days.");
    const supabase = await createClient();
    const { data: tenantId } = await supabase.rpc("current_tenant_id" as never);
    if (!tenantId) throw new UserError("Could not work out which market these settings belong to.");
    const { error } = await supabase
      .from("company_settings")
      .update({ default_return_window_days: days, return_auto_approve: !!input.autoApprove } as never)
      .eq("tenant_id", tenantId as unknown as string);
    if (error) {
      if (error.code === "42703" || error.code === "PGRST204") throw new UserError(MIGRATION);
      throw error;
    }
    revalidatePath("/admin/settings");
  } catch (e) {
    return failure(e) as never;
  }
}

/** Admin: this category's own return period. null = follow the main category or the market default; 0 = items in it cannot be returned. */
export async function setCategoryReturnWindow(categoryId: string, days: number | null): Promise<void> {
  try {
    if (days !== null && !(Number.isInteger(days) && days >= 0 && days <= 90)) throw new UserError("The return period must be a whole number of days, 0 to 90.");
    const supabase = await createClient();
    const { error } = await supabase.from("categories").update({ return_window_days: days } as never).eq("id", categoryId);
    if (error) {
      if (error.code === "42703" || error.code === "PGRST204") throw new UserError(MIGRATION);
      throw error;
    }
    revalidatePath("/admin/categories");
  } catch (e) {
    return failure(e) as never;
  }
}
