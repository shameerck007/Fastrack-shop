import { redirect } from "next/navigation";
import Link from "@/components/Link";
import { getMyStore, getMyStoreProductsPage } from "@/lib/merchant";
import { PageHeader } from "@/components/admin/AdminUi";
import { createClient } from "@/lib/supabase/server";
import MerchantProductSearch from "@/components/merchant/MerchantProductSearch";
import type { Category } from "@/types/database";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

const PAGE_SIZE = 24;

export default async function MerchantProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const store = await getMyStore();
  if (!store) redirect("/sell");

  const supabase = await createClient();
  const [{ items: products, total }, { data: categories }] = await Promise.all([
    getMyStoreProductsPage(store.id, { q: sp.q, page, pageSize: PAGE_SIZE }),
    supabase.from("categories").select("*").order("sort_order"),
  ]);
  const categoryList = (categories as Category[]) ?? [];

  const searching = !!(sp.q ?? "").trim();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon="📦"
        title={t("merchant.products")}
        subtitle={t("merchant.products_count_own", { count: total, plural: total === 1 ? "" : "s" })}
        actions={
          <Link href="/merchant/catalog" className="inline-flex h-10 items-center rounded-full bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800">
            + Add from catalog
          </Link>
        }
      />

      {total === 0 && !searching ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-4xl">📦</span>
          <p className="text-sm text-neutral-500">{t("merchant.no_products_added")}</p>
          <Link href="/merchant/catalog" className="rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white hover:bg-blue-800">
            Browse the product catalog
          </Link>
        </div>
      ) : (
        <MerchantProductSearch products={products} categories={categoryList} total={total} page={page} pageSize={PAGE_SIZE} q={sp.q ?? ""} />
      )}
    </div>
  );
}
