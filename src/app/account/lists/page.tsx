import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWishlistProducts } from "@/lib/wishlist";
import { getProductRatingsMap } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";
import DeliverableProductGrid from "@/components/DeliverableProductGrid";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function ListsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);
  const products = await getWishlistProducts();
  const [ratingsMap, stockMap] = await Promise.all([
    getProductRatingsMap(products.map((p) => p.id)),
    getDefaultVariantStockMap(products),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">{t("lists.title")}</h1>

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-4xl">🤍</span>
          <p className="text-sm text-neutral-500">{t("lists.empty")}</p>
          <Link href="/" className="text-blue-600 hover:underline">
            {t("lists.browse_products")}
          </Link>
        </div>
      ) : (
        <DeliverableProductGrid
          products={products}
          ratings={Object.fromEntries(ratingsMap)}
          stock={Object.fromEntries(stockMap)}
        />
      )}
    </div>
  );
}
