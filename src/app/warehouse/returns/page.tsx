import ReturnsInbox, { type InboxReturn } from "@/components/ReturnsInbox";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Returns" };

type Loose = { from: (t: string) => { select: (c: string) => { order: (c: string, o: object) => { limit: (n: number) => Promise<{ data: unknown; error: unknown }> } } } };

export default async function WarehouseReturnsPage() {
  const supabase = (await createClient()) as unknown as Loose;
  // Row security already limits this to returns coming back to this warehouse.
  const { data, error } = await supabase.from("order_returns").select("*, order_items(product_name), orders(order_number)").order("created_at", { ascending: false }).limit(200);
  const rows = ((data ?? []) as (InboxReturn & { order_items: { product_name: string } | null; orders: { order_number: string } | null })[]).map((r) => ({
    ...r,
    quantity: Number(r.quantity),
    product_name: r.order_items?.product_name ?? "Item",
    order_number: r.orders?.order_number ?? "",
  }));
  return (
    <div>
      <h1 className="text-xl font-semibold">Returns</h1>
      <p className="mb-5 mt-1 text-sm text-neutral-500">Items riders bring back from customers. Check each one in: good items go straight back into the warehouse stock.</p>
      {error ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">Returns are not switched on yet. Ask FasTrack to run the latest database update.</p>
      ) : (
        <ReturnsInbox rows={rows} empty="No returns coming to this warehouse." />
      )}
    </div>
  );
}
