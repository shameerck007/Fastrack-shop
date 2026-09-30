import DeliverableProductList from "@/components/DeliverableProductList";
import DeliveryGate from "@/components/DeliveryGate";
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
  const [ratingsMap, stockMap] = await Promise.all([
    getProductRatingsMap(products.map((p) => p.id)),
    getDefaultVariantStockMap(products),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">
        {q ? `Results for "${q}"` : "Search"}
      </h1>
      {q && (
        <DeliveryGate>
          <DeliverableProductList
            products={products}
            ratings={Object.fromEntries(ratingsMap)}
            stock={Object.fromEntries(stockMap)}
            emptyMessage="No products found. Try a different search term."
          />
        </DeliveryGate>
      )}
    </div>
  );
}
