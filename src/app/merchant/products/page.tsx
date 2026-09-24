import { redirect } from "next/navigation";
import { getMyStore, getMyStoreProducts } from "@/lib/merchant";
import { createClient } from "@/lib/supabase/server";
import MerchantProductForm from "@/components/merchant/MerchantProductForm";
import MerchantProductCard from "@/components/merchant/MerchantProductCard";
import type { Category } from "@/types/database";

export default async function MerchantProductsPage() {
  const store = await getMyStore();
  if (!store) redirect("/sell");

  const supabase = await createClient();
  const [products, { data: categories }] = await Promise.all([
    getMyStoreProducts(store.id),
    supabase.from("categories").select("*").order("sort_order"),
  ]);
  const categoryList = (categories as Category[]) ?? [];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="text-sm text-neutral-500">{products.length} product{products.length === 1 ? "" : "s"} in your catalog</p>
        </div>
        <MerchantProductForm categories={categoryList} />
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-4xl">📦</span>
          <p className="text-sm text-neutral-500">You haven&apos;t added any products yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <MerchantProductCard key={product.id} product={product} categories={categoryList} />
          ))}
        </div>
      )}
    </div>
  );
}
