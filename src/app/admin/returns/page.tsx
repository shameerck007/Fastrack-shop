import { PageHeader } from "@/components/admin/AdminUi";
import ReturnsBoard, { type AdminReturn, type RiderOption } from "@/components/admin/ReturnsBoard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Returns" };

type Loose = { from: (t: string) => { select: (c: string) => { order: (c: string, o: object) => { limit: (n: number) => Promise<{ data: unknown; error: { message: string } | null }> }; eq: (c: string, v: string) => Promise<{ data: unknown }>; in: (c: string, v: string[]) => Promise<{ data: unknown }> } } };

export default async function AdminReturnsPage() {
  const supabase = (await createClient()) as unknown as Loose;
  const { data, error } = await supabase.from("order_returns").select("*, order_items(product_name, variant_label, line_total), orders(order_number)").order("created_at", { ascending: false }).limit(300);

  const header = <PageHeader icon="↩️" title="Returns" subtitle="Customers return individual items, not whole orders. Review them here, send a rider, and the item is refunded when it is collected." />;
  if (error) {
    return (
      <div>
        {header}
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Returns need database migration <b>0098_item_returns.sql</b>. Run it in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  const raw = (data ?? []) as (Omit<AdminReturn, "product_name" | "variant_label" | "line_total" | "order_number" | "customer_name" | "customer_phone" | "rider_name"> & {
    order_items: { product_name: string; variant_label: string | null; line_total: number } | null;
    orders: { order_number: string } | null;
  })[];
  const userIds = [...new Set(raw.map((r) => r.user_id))];
  const profiles = userIds.length ? (((await supabase.from("profiles").select("id, full_name, phone").in("id", userIds)).data ?? []) as { id: string; full_name: string | null; phone: string | null }[]) : [];
  const riderRows = (((await supabase.from("delivery_partners").select("id, profiles(full_name)").eq("status", "approved")).data ?? []) as unknown as { id: string; profiles: { full_name: string | null } | null }[]);
  const riders: RiderOption[] = riderRows.map((r) => ({ id: r.id, name: r.profiles?.full_name ?? "Rider" }));
  const riderName = new Map(riders.map((r) => [r.id, r.name]));
  const byUser = new Map(profiles.map((p) => [p.id, p]));

  const rows: AdminReturn[] = raw.map((r) => ({
    ...r,
    quantity: Number(r.quantity),
    product_name: r.order_items?.product_name ?? "Item",
    variant_label: r.order_items?.variant_label ?? null,
    line_total: Number(r.order_items?.line_total ?? 0),
    order_number: r.orders?.order_number ?? "",
    customer_name: byUser.get(r.user_id)?.full_name ?? "Customer",
    customer_phone: byUser.get(r.user_id)?.phone ?? null,
    rider_name: r.rider_id ? (riderName.get(r.rider_id) ?? null) : null,
  }));

  return (
    <div>
      {header}
      <ReturnsBoard rows={rows} riders={riders} />
    </div>
  );
}
