import { redirect } from "next/navigation";
import CatalogBrowser from "@/components/merchant/CatalogBrowser";
import { getMyStore } from "@/lib/merchant";
import { categoryScope, getStoreMasterIds, searchMasterCatalog } from "@/lib/master-catalog";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Catalog" };

const PAGE_SIZE = 36;

export default async function MerchantCatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const store = await getMyStore();
  if (!store) redirect("/sell");
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id, name, parent_id").order("sort_order");
  const [result, ownedIds, pendingReq, declinedReq] = await Promise.all([
    searchMasterCatalog({ status: "approved", q: sp.q, categoryIds: categoryScope(categories ?? [], sp.cat), page, pageSize: PAGE_SIZE }),
    getStoreMasterIds(store.id).catch(() => new Set<string>()),
    searchMasterCatalog({ status: "pending", requestedByStore: store.id, pageSize: 50 }),
    searchMasterCatalog({ status: "rejected", requestedByStore: store.id, pageSize: 50 }),
  ]);

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-4 sm:p-5">
        <h1 className="text-xl font-semibold text-neutral-900">Product catalog</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">
          Find your product, add it to your store, and set your price and stock. The name, photo and details are kept by FasTrack, so every listing looks right. Not in the catalog? Request it.
        </p>
      </div>
      {result?.error && <p className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">The catalog could not be loaded: {result.error}</p>}
      {result === null ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">The catalog isn&apos;t available yet. Please check back soon.</p>
      ) : (
        <CatalogBrowser
          products={result.items}
          total={result.total}
          page={page}
          pageSize={PAGE_SIZE}
          ownedIds={[...ownedIds]}
          requests={[...(pendingReq?.items ?? []), ...(declinedReq?.items ?? [])]}
          categories={(categories ?? []) as { id: string; name: string; parent_id: string | null }[]}
        />
      )}
    </div>
  );
}
