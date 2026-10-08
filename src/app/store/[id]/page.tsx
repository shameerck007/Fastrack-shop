import { notFound, redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant-server";
import { marketUi } from "@/lib/market-ui";
import StoreHeader from "@/components/StoreHeader";
import StoreHero from "@/components/StoreHero";
import DeliverableProductList from "@/components/DeliverableProductList";
import { getApprovedStoreById, getStoreProducts } from "@/lib/catalog";
import { getStoreDirectory } from "@/lib/stores";
import { getProductRatingsMap } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";

export default async function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // India has no shop pages (the storefront is one catalogue by delivery location).
  if (!marketUi((await getCurrentTenant())?.country_code).showShops) redirect("/");
  const profile = await getApprovedStoreById(id);
  if (!profile) notFound();

  // Branding and hours come from the directory; if it isn't available yet
  // (migration not applied) fall back to the bare profile so the page still works.
  const entry = (await getStoreDirectory()).find((s) => s.id === id);
  const store = entry ?? {
    id: profile.id,
    name: profile.name,
    city: profile.city,
    logo_url: null,
    cover_url: null,
    tagline: null,
    opening_hours: null,
    accepting_orders: true,
  };

  const products = await getStoreProducts(id);
  const [ratingsMap, stockMap] = await Promise.all([
    getProductRatingsMap(products.map((p) => p.id)),
    getDefaultVariantStockMap(products),
  ]);

  return (
    <div>
      <StoreHeader store={store} />
      <StoreHero store={store} />
      <div className="mx-auto max-w-6xl px-4 py-6 max-md:pb-36">
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
