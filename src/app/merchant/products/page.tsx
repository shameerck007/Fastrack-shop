import { redirect } from "next/navigation";
import Link from "@/components/Link";
import { getMyStore, getMyStoreProducts } from "@/lib/merchant";
import { createClient } from "@/lib/supabase/server";
import MerchantProductForm from "@/components/merchant/MerchantProductForm";
import MerchantProductSearch from "@/components/merchant/MerchantProductSearch";
import type { Category } from "@/types/database";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function MerchantProductsPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
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
          <h1 className="text-xl font-semibold">{t("merchant.products")}</h1>
          <p className="text-sm text-neutral-500">{t("merchant.products_count_own", { count: products.length, plural: products.length === 1 ? "" : "s" })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/merchant/catalog" className="rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
            + Add from catalog
          </Link>
          <MerchantProductForm categories={categoryList} />
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-4xl">📦</span>
          <p className="text-sm text-neutral-500">{t("merchant.no_products_added")}</p>
        </div>
      ) : (
        <MerchantProductSearch products={products} categories={categoryList} />
      )}
    </div>
  );
}
