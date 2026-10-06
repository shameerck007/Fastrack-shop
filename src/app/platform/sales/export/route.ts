import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMarketSummaries, getSalesByDay } from "@/lib/platform";

/** Sales per market per day as a CSV, for the platform owner's spreadsheets. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  if (profile?.role !== "super_admin") return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const raw = Number(params.get("days"));
  const marketSlug = params.get("market");
  const days = [7, 14, 30, 90].includes(raw) ? raw : 30;
  const [markets, sales] = await Promise.all([getMarketSummaries(), getSalesByDay(days)]);
  const marketOf = new Map(markets.map((m) => [m.tenant_id, m]));
  const onlyTenant = marketSlug ? markets.find((m) => m.slug === marketSlug)?.tenant_id : undefined;

  const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["market", "country", "currency", "date", "orders", "sales", "avg_order", "delivery_fees", "tax_inside"].join(",")];
  for (const r of [...sales].filter((x) => !onlyTenant || x.tenant_id === onlyTenant).sort((a, b) => (a.day < b.day ? 1 : -1))) {
    const m = marketOf.get(r.tenant_id);
    lines.push(
      [
        csvCell(m?.name ?? r.tenant_id),
        csvCell(m?.country_code ?? ""),
        csvCell(m?.currency ?? ""),
        r.day,
        r.orders,
        r.gmv.toFixed(2),
        (r.orders > 0 ? r.gmv / r.orders : 0).toFixed(2),
        r.delivery_fees.toFixed(2),
        r.tax.toFixed(2),
      ].join(",")
    );
  }
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fastrack-sales-${days}d.csv"`,
    },
  });
}
