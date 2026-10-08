import { createClient } from "@/lib/supabase/server";
import { getAdminProducts } from "@/lib/admin-products";
import { PageHeader } from "@/components/admin/AdminUi";
import Link from "@/components/Link";
import AdminProductSearch from "@/components/admin/AdminProductSearch";
import type { Category, Warehouse } from "@/types/database";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function AdminProductsPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const supabase = await createClient();

  const [products, { data: categories }, { data: warehouses }] = await Promise.all([
    getAdminProducts(),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("warehouses").select("*").eq("is_active", true),
  ]);
  const categoryList = (categories as Category[]) ?? [];
  const warehouseList = (warehouses as Warehouse[]) ?? [];

  return (
    <div>
      <PageHeader
        icon="📦"
        title="Listings & stock"
        subtitle={`${products.length} products on sale. Each shows its price and stock, for FasTrack and for every supplier. The product details (name, photo, category) come from the Product catalog.`}
        actions={
          <Link href="/admin/catalog" className="rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
            + Add from the Product catalog
          </Link>
        }
      />

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-4xl">📦</span>
          <p className="text-sm text-neutral-500">{t("admin.no_products_yet")}</p>
        </div>
      ) : (
        <AdminProductSearch products={products} categories={categoryList} warehouses={warehouseList} />
      )}
    </div>
  );
}
