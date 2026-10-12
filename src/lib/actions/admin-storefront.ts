"use server";

import { UserError, failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Admin: show or hide the supplier shops on the shopping pages. null follows the market's default. */
export async function updateStorefrontSettings(input: { showShops: boolean | null }): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: tenantId } = await supabase.rpc("current_tenant_id" as never);
    if (!tenantId) throw new UserError("Could not work out which market these settings belong to.");
    const { error } = await supabase
      .from("company_settings")
      .update({ show_shops: input.showShops } as never)
      .eq("tenant_id", tenantId as unknown as string);
    if (error) {
      if (error.code === "42703" || error.code === "PGRST204") throw new UserError("This setting needs the latest database update (migration 0100). Run it, then try again.");
      throw error;
    }
    // The home page, shop pages, product pages and the layout all read this.
    revalidatePath("/", "layout");
  } catch (e) {
    return failure(e) as never;
  }
}
