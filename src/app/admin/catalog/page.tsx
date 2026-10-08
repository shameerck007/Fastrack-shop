import CatalogManager from "@/components/admin/CatalogManager";
import { PageHeader, StatGrid, StatTile } from "@/components/admin/AdminUi";
import { categoryScope, countMaster, searchMasterCatalog } from "@/lib/master-catalog";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Master catalog" };

const PAGE_SIZE = 40;

export default async function AdminCatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; tab?: string; page?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "requests" ? "requests" : "catalog";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id, name, parent_id").order("sort_order");
  const [result, approvedCount, pendingCount, { data: warehouses }, { data: stores }, { data: ownProducts }] = await Promise.all([
    searchMasterCatalog({ status: tab === "requests" ? "pending" : "approved", q: sp.q, categoryIds: categoryScope(categories ?? [], sp.cat), page, pageSize: PAGE_SIZE, withOffers: true }),
    countMaster("approved"),
    countMaster("pending"),
    supabase.from("warehouses").select("id, name").eq("is_active", true).order("created_at"),
    supabase.from("stores").select("warehouse_id"),
    supabase.from("products").select("master_id").is("store_id", null).not("master_id" as never, "is", null),
  ]);
  const supplierWarehouses = new Set((stores ?? []).map((s) => s.warehouse_id).filter(Boolean));
  const fastrackLocations = (warehouses ?? []).filter((w) => !supplierWarehouses.has(w.id)) as { id: string; name: string }[];
  const fastrackIds = ((ownProducts ?? []) as unknown as { master_id: string }[]).map((p) => p.master_id);

  if (result === null) {
    return (
      <div>
        <PageHeader icon="📚" title="Product catalog" subtitle="One shared list of products. Suppliers sell them by adding their price and stock." />
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          The product catalog isn&apos;t set up in the database yet. Run migration <b>0067_master_catalog.sql</b> in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  const { count: offerCount } = await supabase.from("products").select("id", { count: "exact", head: true }).not("master_id" as never, "is", null);
  const offers = offerCount ?? 0;

  return (
    <div>
      <PageHeader
        icon="📚"
        title="Product catalog"
        subtitle="What each product is: name, brand, photo, category, barcode and tax. Suppliers sell a product by adding their own price and stock, so it is never listed twice. Prices and stock are under Listings & stock."
      />
      <StatGrid>
        <StatTile icon="📚" label="Catalog products" value={approvedCount.toLocaleString()} accent="#2563eb" />
        <StatTile icon="📭" label="Requests to review" value={pendingCount} accent="#0369a1" hint={pendingCount > 0 ? "Suppliers are waiting" : undefined} />
        <StatTile icon="🏪" label="Supplier listings" value={offers.toLocaleString()} accent="#1e40af" hint="Offers linked to catalog products" />
        <StatTile icon="🔗" label="Average suppliers per product" value={approvedCount ? (offers / approvedCount).toFixed(1) : "0"} accent="#0ea5e9" />
      </StatGrid>
      <CatalogManager products={result.items} total={result.total} page={page} pageSize={PAGE_SIZE} tab={tab} approvedCount={approvedCount} pendingCount={pendingCount} categories={(categories ?? []) as { id: string; name: string; parent_id: string | null }[]} fastrackLocations={fastrackLocations} fastrackIds={fastrackIds} />
    </div>
  );
}
