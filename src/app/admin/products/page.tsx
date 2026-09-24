import { createClient } from "@/lib/supabase/server";
import NewProductForm from "@/components/admin/NewProductForm";
import StockCell from "@/components/admin/StockCell";
import { updateProductStock } from "@/lib/actions/admin-products";
import { formatSAR } from "@/lib/utils";
import type { Category, Warehouse } from "@/types/database";

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  is_active: boolean;
  category: { name: string } | null;
  product_variants: {
    id: string;
    label: string;
    price: number;
    inventory: { id: string; stock: number; min_stock: number; warehouse_id: string }[];
  }[];
}

export default async function AdminProductsPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: categories }, { data: warehouses }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, brand, image_url, is_active, category:categories(name), product_variants(id, label, price, inventory(id, stock, min_stock, warehouse_id))")
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("warehouses").select("*").eq("is_active", true),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Products</h1>

      <div className="mb-6">
        <NewProductForm
          categories={(categories as Category[]) ?? []}
          warehouses={(warehouses as Warehouse[]) ?? []}
        />
      </div>

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
            {((products as unknown as ProductRow[]) ?? []).map((product) =>
              product.product_variants.map((variant, i) => {
                const inv = variant.inventory[0];
                return (
                  <tr key={variant.id} className="border-t border-neutral-100">
                    {i === 0 && (
                      <td className="px-4 py-2 font-medium" rowSpan={product.product_variants.length}>
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
                            {product.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-sm">📦</span>
                            )}
                          </div>
                          <div>
                            {product.name}
                            {product.brand && (
                              <span className="block text-xs text-neutral-400">{product.brand}</span>
                            )}
                          </div>
                        </div>
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
                          updateAction={updateProductStock}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    {i === 0 && (
                      <td className="px-4 py-2" rowSpan={product.product_variants.length}>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            product.is_active
                              ? "bg-blue-50 text-blue-700"
                              : "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
