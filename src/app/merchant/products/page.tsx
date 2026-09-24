import { redirect } from "next/navigation";
import { getMyStore, getMyStoreProducts } from "@/lib/merchant";
import { createClient } from "@/lib/supabase/server";
import NewMerchantProductForm from "@/components/merchant/NewMerchantProductForm";
import StockCell from "@/components/admin/StockCell";
import { updateMerchantProductStock, toggleMerchantProductActive } from "@/lib/actions/merchant-products";
import { formatSAR } from "@/lib/utils";
import type { Category } from "@/types/database";

export default async function MerchantProductsPage() {
  const store = await getMyStore();
  if (!store) redirect("/sell");

  const supabase = await createClient();
  const [products, { data: categories }] = await Promise.all([
    getMyStoreProducts(store.id),
    supabase.from("categories").select("*").order("sort_order"),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Products</h1>

      <div className="mb-6">
        <NewMerchantProductForm categories={(categories as Category[]) ?? []} />
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-neutral-500">You haven&apos;t added any products yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Variant</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Stock</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) =>
                product.product_variants.map((variant, i) => {
                  const inv = variant.inventory[0];
                  return (
                    <tr key={variant.id} className="border-t border-neutral-100">
                      {i === 0 && (
                        <td className="px-4 py-2 font-medium" rowSpan={product.product_variants.length}>
                          {product.name}
                          {product.brand && (
                            <span className="block text-xs text-neutral-400">{product.brand}</span>
                          )}
                        </td>
                      )}
                      {i === 0 && (
                        <td className="px-4 py-2 text-neutral-600" rowSpan={product.product_variants.length}>
                          {product.category?.name ?? "—"}
                        </td>
                      )}
                      <td className="px-4 py-2">{variant.label}</td>
                      <td className="px-4 py-2">{formatSAR(variant.price)}</td>
                      <td className="px-4 py-2">
                        {inv ? (
                          <StockCell
                            inventoryId={inv.id}
                            stock={inv.stock}
                            minStock={inv.min_stock}
                            updateAction={updateMerchantProductStock}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      {i === 0 && (
                        <td className="px-4 py-2" rowSpan={product.product_variants.length}>
                          <form
                            action={async () => {
                              "use server";
                              await toggleMerchantProductActive(product.id, !product.is_active);
                            }}
                          >
                            <button
                              type="submit"
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                product.is_active
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-neutral-100 text-neutral-500"
                              }`}
                            >
                              {product.is_active ? "Active" : "Inactive"}
                            </button>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
