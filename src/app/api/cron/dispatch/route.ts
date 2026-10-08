import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyUsers } from "@/lib/push";

// Called every minute by the cron worker (cron-worker/). Moves quick-delivery offers along: expires old ones, offers
// waiting Express orders to the next nearest rider, and alerts the market's admins about an order nobody could take.
// Protected by a shared secret; without CRON_SECRET configured it refuses every request.
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const db = createServiceClient();
  const { data, error } = await db.rpc("sweep_express_dispatch");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { out_order_id: string; out_rider_id: string | null; out_order_number: string; out_alert: boolean }[];
  let offered = 0;
  let alerted = 0;
  for (const r of rows) {
    if (r.out_rider_id) {
      offered++;
      await notifyUsers([r.out_rider_id], { title: "New Express order", body: `Order #${r.out_order_number} is waiting. Accept it now.`, url: "/rider" }, db);
    } else if (r.out_alert) {
      alerted++;
      const { data: order } = await db.from("orders").select("tenant_id").eq("id", r.out_order_id).maybeSingle();
      const { data: admins } = await db
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("tenant_id", (order as { tenant_id: string } | null)?.tenant_id ?? "");
      await notifyUsers(
        ((admins ?? []) as { id: string }[]).map((a) => a.id),
        { title: "Express order needs a rider", body: `Order #${r.out_order_number} has no rider in range yet.`, url: "/admin/orders" },
        db
      );
    }
  }
  // Low stock at FasTrack locations: tell that location's staff and the market's admins once per item (no-op before migration 0068).
  const low = await db.rpc("sweep_low_stock");
  for (const r of ((low.error ? [] : low.data) ?? []) as { out_warehouse_id: string; out_count: number; out_sample: string }[]) {
    const { data: staff } = await db.from("warehouse_staff").select("user_id").eq("warehouse_id", r.out_warehouse_id);
    const { data: wh } = await db.from("warehouses").select("name, tenant_id").eq("id", r.out_warehouse_id).maybeSingle();
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").eq("tenant_id", (wh as { tenant_id: string } | null)?.tenant_id ?? "");
    const who = [...((staff ?? []) as { user_id: string }[]).map((s) => s.user_id), ...((admins ?? []) as { id: string }[]).map((a) => a.id)];
    await notifyUsers(who, { title: "Stock running low", body: `${(wh as { name: string } | null)?.name ?? "A location"}: ${r.out_count} item${r.out_count === 1 ? "" : "s"} below minimum (${r.out_sample}).`, url: "/admin/transfers" }, db);
  }

  // Standard routes: route anything missed, drop cancelled orders, close empty routes (no-op before migration 0066).
  const swept = await db.rpc("sweep_standard_routes");
  return NextResponse.json({ ok: true, offered, alerted, routed: swept.error ? 0 : swept.data });
}
