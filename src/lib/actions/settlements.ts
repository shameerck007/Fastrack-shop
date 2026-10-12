"use server";

import { UserError, failure } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant-server";
import { timeZoneFor } from "@/lib/admin-dashboard";
import type { Statement } from "@/lib/statement";
import type { RiderStatement } from "@/lib/rider-statement";

/** The numbers of a rider's statement for a period, for the preview in the statement popup. */
export async function getRiderStatementPreview(riderId: string, from: string, to: string): Promise<RiderStatement> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new UserError("Choose the dates for the statement.");
    if (to < from) throw new UserError("The end date is before the start date.");
    const supabase = await createClient();
    const tenant = await getCurrentTenant();
    const { data, error } = await supabase.rpc("rider_statement" as never, { p_rider: riderId, p_from: from, p_to: to, p_tz: timeZoneFor(tenant?.country_code) } as never);
    if (error) throw error;
    return data as unknown as RiderStatement;
  } catch (e) {
    return failure(e) as never;
  }
}

/** The numbers of a supplier's statement for a period, for the preview in the statement popup. */
export async function getStatementPreview(storeId: string, from: string, to: string): Promise<Statement> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new UserError("Choose the dates for the statement.");
    if (to < from) throw new UserError("The end date is before the start date.");
    const supabase = await createClient();
    const tenant = await getCurrentTenant();
    const { data, error } = await supabase.rpc("supplier_statement" as never, { p_store: storeId, p_from: from, p_to: to, p_tz: timeZoneFor(tenant?.country_code) } as never);
    if (error) throw error;
    return data as unknown as Statement;
  } catch (e) {
    return failure(e) as never;
  }
}
