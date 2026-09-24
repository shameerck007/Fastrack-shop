import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminAnalytics } from "@/lib/admin-analytics";
import { formatSAR, ORDER_STATUS_LABELS } from "@/lib/utils";
import RevenueTrendChart from "@/components/admin/charts/RevenueTrendChart";
import BarList from "@/components/admin/charts/BarList";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  confirmed: "bg-blue-50 text-blue-700",
  preparing: "bg-blue-50 text-blue-700",
  ready_for_pickup: "bg-amber-50 text-amber-700",
  rider_assigned: "bg-amber-50 text-amber-700",
  out_for_delivery: "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

// A single hue ramping light -> dark tracks order progress (pending through
// out-for-delivery); the two terminal states get their own reserved status
// colors (green = success, red = failure) rather than continuing the ramp.
const STATUS_BAR_COLORS: Record<string, string> = {
  pending: "#bfdbfe",
  confirmed: "#93c5fd",
  preparing: "#60a5fa",
  ready_for_pickup: "#3b82f6",
  rider_assigned: "#2563eb",
  out_for_delivery: "#1d4ed8",
  delivered: "#059669",
  cancelled: "#dc2626",
};

const STATUS_ORDER = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "rider_assigned",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    { count: todayOrders },
    { count: pendingOrders },
    { data: todaySales },
    { data: stockLevels },
    { count: pendingMerchants },
    { count: totalProducts },
    { data: recentOrders },
    analytics,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfToday.toISOString()),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "confirmed", "preparing"]),
    supabase.from("orders").select("total").gte("created_at", startOfToday.toISOString()),
    supabase.from("inventory").select("stock, min_stock"),
    supabase.from("stores").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id, order_number, status, total, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    getAdminAnalytics(),
  ]);

  const revenueToday = (todaySales ?? []).reduce((sum, o) => sum + Number(o.total), 0);
  const lowStockCount = (stockLevels ?? []).filter((i) => Number(i.stock) < Number(i.min_stock)).length;

  const todayStats = [
    { label: "Today's orders", value: todayOrders ?? 0, icon: "🧾", color: "bg-blue-50 text-blue-700", href: "/admin/orders" },
    { label: "Pending orders", value: pendingOrders ?? 0, icon: "⏳", color: "bg-amber-50 text-amber-700", href: "/admin/orders" },
    { label: "Today's revenue", value: formatSAR(revenueToday), icon: "💰", color: "bg-emerald-50 text-emerald-700", href: "/admin/orders" },
    {
      label: "Low stock items",
      value: lowStockCount,
      icon: "⚠️",
      color: lowStockCount > 0 ? "bg-red-50 text-red-700" : "bg-neutral-50 text-neutral-500",
      href: "/admin/products",
    },
  ];

  const businessStats = [
    { label: "30-day revenue", value: formatSAR(analytics.revenue30d), icon: "📈", color: "bg-emerald-50 text-emerald-700" },
    { label: "30-day orders", value: analytics.orders30d, icon: "🧾", color: "bg-blue-50 text-blue-700" },
    { label: "Avg. order value", value: formatSAR(analytics.avgOrderValue30d), icon: "🧮", color: "bg-violet-50 text-violet-700" },
    { label: "Total customers", value: analytics.totalCustomers, icon: "👥", color: "bg-cyan-50 text-cyan-700" },
    { label: "New customers (30d)", value: analytics.newCustomers30d, icon: "✨", color: "bg-blue-50 text-blue-700" },
    { label: "Products", value: totalProducts ?? 0, icon: "📦", color: "bg-blue-50 text-blue-700", href: "/admin/products" },
    {
      label: "Pending merchants",
      value: pendingMerchants ?? 0,
      icon: "🏪",
      color: (pendingMerchants ?? 0) > 0 ? "bg-amber-50 text-amber-700" : "bg-neutral-50 text-neutral-500",
      href: "/admin/merchants",
    },
  ];

  const orderedStatusCounts = STATUS_ORDER.map((status) => ({
    status,
    count: analytics.statusCounts.find((s) => s.status === status)?.count ?? 0,
  })).filter((s) => s.count > 0 || ["pending", "delivered", "cancelled"].includes(s.status));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Dashboard</h1>
      <p className="mb-6 text-sm text-neutral-500">Live overview of orders, stock and merchant activity.</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {todayStats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${s.color}`}>
                {s.icon}
              </span>
              <div>
                <p className="text-sm text-neutral-500">{s.label}</p>
                <p className="text-2xl font-semibold">{s.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/products"
          className="rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          + Add product
        </Link>
        <Link
          href="/admin/categories"
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
        >
          + Add category
        </Link>
        {(pendingMerchants ?? 0) > 0 && (
          <Link
            href="/admin/merchants"
            className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
          >
            {pendingMerchants} merchant application{pendingMerchants === 1 ? "" : "s"} to review
          </Link>
        )}
      </div>

      <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-medium">Revenue trend</p>
          <span className="text-xs text-neutral-400">Last 14 days</span>
        </div>
        <RevenueTrendChart data={analytics.dailyRevenue} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {businessStats.map((s) => {
          const content = (
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${s.color}`}>
                {s.icon}
              </span>
              <div>
                <p className="text-sm text-neutral-500">{s.label}</p>
                <p className="text-2xl font-semibold">{s.value}</p>
              </div>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:shadow-md">
              {content}
            </Link>
          ) : (
            <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-4">
              {content}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium">Orders by status (30d)</p>
          <BarList
            items={orderedStatusCounts.map((s) => ({
              label: ORDER_STATUS_LABELS[s.status] ?? s.status,
              value: s.count,
              color: STATUS_BAR_COLORS[s.status],
            }))}
            formatValue={(v) => String(v)}
          />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium">Top products (30d)</p>
          <BarList items={analytics.topProducts} formatValue={formatSAR} emptyLabel="No sales in the last 30 days." />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium">Revenue by category (30d)</p>
          <BarList items={analytics.topCategories} formatValue={formatSAR} emptyLabel="No sales in the last 30 days." />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Recent orders</p>
          <Link href="/admin/orders" className="text-xs text-blue-600 hover:underline">
            View all →
          </Link>
        </div>
        {(recentOrders ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">No orders yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-neutral-100">
            {(recentOrders ?? []).map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium">#{order.order_number}</p>
                  <p className="text-xs text-neutral-400">{new Date(order.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-700">{formatSAR(order.total)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[order.status] ?? "bg-neutral-100 text-neutral-600"}`}
                  >
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
