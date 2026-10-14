import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * The small numbers shown beside portal menu items ("Orders 9": things waiting for the person). One light request every minute or so
 * from the menu. Every query runs as the signed-in person, so the database's own rules decide what they may count (a supplier counts
 * only their own orders, an admin only their own market's). A failing count simply leaves its badge off.
 */
type Counts = Record<string, number>;

export async function GET(request: Request) {
  const portal = new URL(request.url).searchParams.get("portal");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({}, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const count = async (build: () => PromiseLike<{ count: number | null; error: unknown }>): Promise<number> => {
    try {
      const { count: n, error } = await build();
      return error ? 0 : (n ?? 0);
    } catch {
      return 0;
    }
  };
  const head = { count: "exact" as const, head: true };
  const out: Counts = {};

  if (portal === "admin") {
    const [orders, returns, merchants, riders] = await Promise.all([
      count(() => db.from("orders").select("id", head).eq("status", "pending")),
      count(() => db.from("order_returns").select("id", head).eq("status", "requested")),
      count(() => db.from("stores").select("id", head).eq("status", "pending")),
      count(() => db.from("delivery_partners").select("id", head).eq("status", "pending")),
    ]);
    out["/admin/orders"] = orders;
    out["/admin/returns"] = returns;
    out["/admin/merchants"] = merchants;
    out["/admin/users"] = riders;
  } else if (portal === "merchant") {
    const [orders, returns] = await Promise.all([
      count(() => db.from("orders").select("id", head).eq("status", "pending")),
      count(() => db.from("order_returns").select("id", head).eq("return_to", "supplier").eq("status", "picked_up").is("received_at", null)),
    ]);
    out["/merchant/orders"] = orders;
    out["/merchant/returns"] = returns;
  } else if (portal === "warehouse") {
    const [orders, returns] = await Promise.all([
      count(() => db.from("orders").select("id", head).eq("status", "pending")),
      count(() => db.from("order_returns").select("id", head).eq("status", "picked_up").is("received_at", null)),
    ]);
    out["/warehouse/orders"] = orders;
    out["/warehouse/returns"] = returns;
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
