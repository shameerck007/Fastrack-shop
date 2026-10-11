import { PageHeader } from "@/components/admin/AdminUi";
import OffersManager, { type OfferRow } from "@/components/admin/OffersManager";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Offers & coupons" };

export default async function AdminOffersPage() {
  const supabase = await createClient();
  // The offers tables are not in the generated types until the migration is in.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const [offersResult, redemptionsResult, { data: categories }] = await Promise.all([
    db.from("offers").select("*").order("created_at", { ascending: false }),
    db.from("offer_redemptions").select("offer_id, amount"),
    supabase.from("categories").select("id, name, parent_id").order("sort_order"),
  ]);
  const notReady = !!offersResult.error;
  const used = new Map<string, { count: number; amount: number }>();
  for (const r of ((redemptionsResult.data ?? []) as { offer_id: string; amount: number | string }[])) {
    const u = used.get(r.offer_id) ?? { count: 0, amount: 0 };
    u.count += 1;
    u.amount += Number(r.amount);
    used.set(r.offer_id, u);
  }
  const offers = ((notReady ? [] : offersResult.data) as Omit<OfferRow, "used" | "discountGiven">[] | null ?? []).map((o) => ({ ...o, used: used.get(o.id)?.count ?? 0, discountGiven: used.get(o.id)?.amount ?? 0 }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon="🏷️" title="Offers & coupons" subtitle="Coupon codes and automatic offers: percentage off, amount off or free delivery, with dates, limits and a minimum order." />
      {notReady && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Offers aren&apos;t set up in the database yet. Run migration <b>0081_offers_and_delivery_fees.sql</b> in the Supabase SQL editor, then reload this page.
        </p>
      )}
      <OffersManager offers={offers} categories={(categories ?? []) as { id: string; name: string; parent_id: string | null }[]} disabled={notReady} />
    </div>
  );
}
