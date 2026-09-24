import ProductCard from "@/components/ProductCard";
import { searchProducts } from "@/lib/catalog";
import { getProductRatingsMap } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const products = q ? await searchProducts(q) : [];
  const [ratings, stock] = await Promise.all([
    getProductRatingsMap(products.map((p) => p.id)),
    getDefaultVariantStockMap(products),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">
        {q ? `Results for "${q}"` : "Search"}
      </h1>
      {q && products.length === 0 && (
        <p className="text-sm text-neutral-500">No products found. Try a different search term.</p>
      )}
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
    </div>
  );
}
