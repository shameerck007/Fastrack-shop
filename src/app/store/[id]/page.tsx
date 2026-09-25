import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import StoreHeader from "@/components/StoreHeader";
import { getApprovedStoreById, getStoreProducts } from "@/lib/catalog";
import { getProductRatingsMap } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";

export default async function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getApprovedStoreById(id);
  if (!store) notFound();

  const products = await getStoreProducts(id);
  const [ratings, stock] = await Promise.all([
    getProductRatingsMap(products.map((p) => p.id)),
    getDefaultVariantStockMap(products),
  ]);

  return (
    <div>
      <StoreHeader storeName={store.name} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="mb-4 text-sm text-neutral-500">{store.city}</p>
        {products.length === 0 ? (
          <p className="text-sm text-neutral-500">This store hasn&apos;t listed any products yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                rating={ratings.get(product.id)}
                stock={stock.get(product.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
