import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant-server";
import { timeZoneFor } from "@/lib/admin-dashboard";
import { getCompanySettings } from "@/lib/company-settings";
import { friendlyMessage } from "@/lib/errors";
import { riderStatementCsv, type RiderStatement } from "@/lib/rider-statement";
import { buildRiderStatementPdf } from "@/lib/rider-statement-pdf";

/** Downloads a rider's settlement statement as PDF or CSV. The database checks that it is the rider themselves or an admin of the same market. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rider = url.searchParams.get("rider") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const format = url.searchParams.get("format") === "csv" ? "csv" : "pdf";
  if (!/^[0-9a-f-]{36}$/i.test(rider) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) {
    return NextResponse.json({ error: "Choose a rider and a valid period." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === rider) {
    const { data: me } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { hide_earnings?: boolean } | null }> } } } }).from("delivery_partners").select("hide_earnings").eq("id", rider).maybeSingle();
    if (me?.hide_earnings) return NextResponse.json({ error: "Your statement is not available. Ask FasTrack if you need one." }, { status: 403 });
  }
  const tenant = await getCurrentTenant();
  const { data, error } = await supabase.rpc("rider_statement" as never, { p_rider: rider, p_from: from, p_to: to, p_tz: timeZoneFor(tenant?.country_code) } as never);
  if (error || !data) return NextResponse.json({ error: friendlyMessage(error ?? new Error("No statement")) }, { status: error ? 403 : 404 });
  const statement = data as unknown as RiderStatement;
  const currency = tenant?.currency ?? "SAR";
  const safe = statement.rider.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "rider";
  const name = `rider-statement-${safe}-${from}-to-${to}`;
  if (format === "csv") {
    return new NextResponse("﻿" + riderStatementCsv(statement, currency), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
  }
  const company = await getCompanySettings().catch(() => null);
  const bytes = await buildRiderStatementPdf(statement, currency, company?.trading_name ?? "FasTrack Shop");
  return new NextResponse(bytes as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
}
