import { redirect } from "next/navigation";
import CatalogBrowser from "@/components/merchant/CatalogBrowser";
import { getMyStore } from "@/lib/merchant";
import { getMasterCatalog, getStoreMasterIds } from "@/lib/master-catalog";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Catalog" };

export default async function MerchantCatalogPage() {
  const store = await getMyStore();
  if (!store) redirect("/sell");
  const supabase = await createClient();
  const [all, ownedIds, { data: categories }] = await Promise.all([
    getMasterCatalog(),
    getStoreMasterIds(store.id).catch(() => new Set<string>()),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-4 sm:p-5">
        <h1 className="text-xl font-semibold text-neutral-900">Product catalog</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">
          Find your product, add it to your store, and set your price and stock. The name, photo and details are kept by FasTrack, so every listing looks right. Not in the catalog? Request it.
        </p>
      </div>
      {all === null ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">The catalog isn&apos;t available yet. Please check back soon.</p>
      ) : (
        <CatalogBrowser
          products={all.filter((p) => p.status === "approved")}
          ownedIds={[...ownedIds]}
          requests={all.filter((p) => p.requestedByStore === store.id && p.status !== "approved")}
          categories={(categories ?? []) as { id: string; name: string }[]}
        />
      )}
    </div>
  );
}
