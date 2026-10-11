import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant-server";
import { timeZoneFor } from "@/lib/admin-dashboard";
import { getCompanySettings } from "@/lib/company-settings";
import { friendlyMessage } from "@/lib/errors";
import { statementCsv, type Statement } from "@/lib/statement";
import { buildStatementPdf } from "@/lib/statement-pdf";

/** Downloads a supplier's settlement statement as PDF or CSV. The database checks who may see which supplier. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = url.searchParams.get("store") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const format = url.searchParams.get("format") === "csv" ? "csv" : "pdf";
  if (!/^[0-9a-f-]{36}$/i.test(store) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) {
    return NextResponse.json({ error: "Choose a supplier and a valid period." }, { status: 400 });
  }
  const supabase = await createClient();
  const tenant = await getCurrentTenant();
  const { data, error } = await supabase.rpc("supplier_statement" as never, { p_store: store, p_from: from, p_to: to, p_tz: timeZoneFor(tenant?.country_code) } as never);
  if (error || !data) return NextResponse.json({ error: friendlyMessage(error ?? new Error("No statement")) }, { status: error ? 403 : 404 });
  const statement = data as unknown as Statement;
  const currency = tenant?.currency ?? "SAR";
  const safe = statement.store.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "supplier";
  const name = `statement-${safe}-${from}-to-${to}`;
  if (format === "csv") {
    return new NextResponse("﻿" + statementCsv(statement, currency), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
  }
  const company = await getCompanySettings().catch(() => null);
  const bytes = await buildStatementPdf(statement, currency, company?.trading_name ?? "FasTrack Shop");
  return new NextResponse(bytes as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
}
