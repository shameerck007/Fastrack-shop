import { redirect } from "next/navigation";
import Link from "@/components/Link";
import { getMyStore, getMyStoreProductsPage, type ProductSort, type ProductView } from "@/lib/merchant";
import PortalPageHeader from "@/components/ui/PortalPageHeader";
import { createClient } from "@/lib/supabase/server";
import MerchantProductSearch from "@/components/merchant/MerchantProductSearch";
import type { Category } from "@/types/database";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

const PAGE_SIZE = 24;

export default async function MerchantProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; view?: string; cat?: string; sort?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const store = await getMyStore();
  if (!store) redirect("/sell");

  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("*").order("sort_order");
  const categoryList = (categories as Category[]) ?? [];
  const view = (["active", "inactive", "low", "out"].includes(sp.view ?? "") ? sp.view : "all") as ProductView;
  const sort = (["oldest", "name"].includes(sp.sort ?? "") ? sp.sort : "new") as ProductSort;
  // A parent category includes its sub-categories.
  const cat = sp.cat && categoryList.some((c) => c.id === sp.cat) ? sp.cat : "";
  const categoryIds = cat ? [cat, ...categoryList.filter((c) => c.parent_id === cat).map((c) => c.id)] : [];
  const { items: products, total } = await getMyStoreProductsPage(store.id, { q: sp.q, page, pageSize: PAGE_SIZE, view, categoryIds, sort });

  const searching = !!(sp.q ?? "").trim() || view !== "all" || !!cat;

  return (
    <div className="flex flex-col gap-5">
      <PortalPageHeader
        icon="📦"
        title={t("merchant.products")}
        subtitle={t("merchant.products_count_own", { count: total, plural: total === 1 ? "" : "s" })}
        actions={
          <Link href="/merchant/catalog" className="inline-flex h-10 items-center rounded-full bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800">
            + Add from catalog
          </Link>
        }
      />

      {total === 0 && !searching ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-4xl">📦</span>
          <p className="text-sm text-neutral-500">{t("merchant.no_products_added")}</p>
          <Link href="/merchant/catalog" className="rounded-full bg-brand-700 px-5 py-2 text-sm font-bold text-white hover:bg-brand-800">
            Browse the product catalog
          </Link>
        </div>
      ) : (
        <MerchantProductSearch products={products} categories={categoryList} total={total} page={page} pageSize={PAGE_SIZE} q={sp.q ?? ""} view={view} cat={cat} sort={sort} />
      )}
    </div>
  );
}
