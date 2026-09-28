import { createClient } from "@/lib/supabase/server";
import { getAdminProducts } from "@/lib/admin-products";
import ProductForm from "@/components/admin/ProductForm";
import AdminProductCard from "@/components/admin/AdminProductCard";
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("admin.products")}</h1>
          <p className="text-sm text-neutral-500">{t("admin.products_count", { count: products.length, plural: products.length === 1 ? "" : "s" })}</p>
        </div>
        <ProductForm categories={categoryList} warehouses={warehouseList} />
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-4xl">📦</span>
          <p className="text-sm text-neutral-500">{t("admin.no_products_yet")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <AdminProductCard
              key={product.id}
              product={product}
              categories={categoryList}
              warehouses={warehouseList}
            />
          ))}
        </div>
      )}
    </div>
  );
}
