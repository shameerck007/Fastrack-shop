import { createClient } from "@/lib/supabase/server";
import { formatSAR } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [{ count: todayOrders }, { count: pendingOrders }, { data: todaySales }, { count: lowStock }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfToday.toISOString()),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "confirmed", "preparing"]),
      supabase.from("orders").select("total").gte("created_at", startOfToday.toISOString()),
      supabase.from("inventory").select("*", { count: "exact", head: true }),
    ]);

  const revenueToday = (todaySales ?? []).reduce((sum, o) => sum + Number(o.total), 0);

  const stats = [
    { label: "Today's orders", value: todayOrders ?? 0 },
    { label: "Pending orders", value: pendingOrders ?? 0 },
    { label: "Today's revenue", value: formatSAR(revenueToday) },
    { label: "Inventory lines", value: lowStock ?? 0 },
  ];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-sm text-neutral-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
