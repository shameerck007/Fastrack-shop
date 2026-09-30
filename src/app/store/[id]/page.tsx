import { notFound } from "next/navigation";
import StoreHeader from "@/components/StoreHeader";
import DeliverableProductList from "@/components/DeliverableProductList";
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
  const [ratingsMap, stockMap] = await Promise.all([
    getProductRatingsMap(products.map((p) => p.id)),
    getDefaultVariantStockMap(products),
  ]);

  return (
    <div>
      <StoreHeader storeName={store.name} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="mb-4 text-sm text-neutral-500">{store.city}</p>
        <DeliverableProductList
          products={products}
          ratings={Object.fromEntries(ratingsMap)}
          stock={Object.fromEntries(stockMap)}
          emptyMessage="This store hasn't listed any products yet."
        />
      </div>
    </div>
  );
}
