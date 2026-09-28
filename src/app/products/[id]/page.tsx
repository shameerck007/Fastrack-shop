import { notFound } from "next/navigation";
import ProductBuyBox from "@/components/ProductBuyBox";
import ProductAlternatives from "@/components/ProductAlternatives";
import Breadcrumbs from "@/components/Breadcrumbs";
import StarRating from "@/components/StarRating";
import ReviewForm from "@/components/ReviewForm";
import TrackRecentlyViewed from "@/components/TrackRecentlyViewed";
import RecentlyViewed from "@/components/RecentlyViewed";
import { getProductById, getProductsByCategory } from "@/lib/catalog";
import { getProductRating, getProductReviews, getProductRatingsMap } from "@/lib/reviews";
import { getVariantStockMap, getDefaultVariantStockMap } from "@/lib/inventory";
import { formatSAR } from "@/lib/utils";
import { getCategoryTheme } from "@/lib/categoryTheme";
import { createClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { localizedName, localizedField } from "@/lib/i18n/localized";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const product = await getProductById(id);

  if (!product) notFound();

  const supabase = await createClient();
  const [rating, reviews, stockMap, { data: { user } }] = await Promise.all([
    getProductRating(id),
    getProductReviews(id),
    getVariantStockMap(product.product_variants.map((v) => v.id)),
    supabase.auth.getUser(),
  ]);
  const stock = Object.fromEntries(stockMap);
  const isLoggedIn = !!user;

  const variant =
    product.product_variants.find((v) => v.is_default) ?? product.product_variants[0];
  const theme = getCategoryTheme(product.category?.slug);
  const productName = localizedName(product, locale);

  // In case the seller can't deliver here — a few deliverable alternatives
  // from the same category, so a blocked shopper isn't left at a dead end.
  const alternativeProducts = product.category
    ? (await getProductsByCategory(product.category.slug)).products
        .filter((p) => p.id !== product.id)
        .slice(0, 6)
    : [];
  const [altRatingsMap, altStockMap] = await Promise.all([
    getProductRatingsMap(alternativeProducts.map((p) => p.id)),
    getDefaultVariantStockMap(alternativeProducts),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <TrackRecentlyViewed productId={id} />
      <Breadcrumbs
        items={[
          { label: t("category.home"), href: "/" },
          ...(product.category
            ? [{ label: localizedName(product.category, locale), href: `/categories/${product.category.slug}` }]
            : []),
          { label: productName },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div
            className={`flex h-72 items-center justify-center rounded-2xl bg-gradient-to-br text-8xl lg:sticky lg:top-20 ${theme.gradient}`}
          >
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={productName} className="h-full w-full rounded-2xl object-cover" />
            ) : (
              <span className="drop-shadow-sm">{theme.emoji}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm text-neutral-500">{localizedField(product.brand, product.brand_ar, locale)}</p>
              {product.is_fresh && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  {locale === "ar" ? "طازج" : "Fresh"}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold">{productName}</h1>
            {rating ? (
              <a href="#reviews" className="mt-1 inline-block">
                <StarRating rating={rating.avg_rating} count={rating.review_count} />
              </a>
            ) : (
              <p className="mt-1 text-xs text-neutral-400">{t("product.no_reviews_yet")}</p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm text-neutral-600">
            {product.origin && (
              <>
                <dt className="font-medium">{t("product.origin")}</dt>
                <dd>{localizedField(product.origin, product.origin_ar, locale)}</dd>
              </>
            )}
            {product.category && (
              <>
                <dt className="font-medium">{t("product.category_label")}</dt>
                <dd>{localizedName(product.category, locale)}</dd>
              </>
            )}
          </dl>

          {product.description && (
            <div>
              <h2 className="mb-1 font-medium">{t("product.about_item")}</h2>
              <p className="text-sm text-neutral-600">
                {localizedField(product.description, product.description_ar, locale)}
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 lg:sticky lg:top-20">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-700">
                {variant ? formatSAR(variant.price) : "—"}
              </span>
              {variant?.compare_at_price && (
                <span className="text-neutral-400 line-through">
                  {formatSAR(variant.compare_at_price)}
                </span>
              )}
            </div>
            {product.is_variable_weight && product.price_per_kg && (
              <p className="mb-2 text-xs text-neutral-500">
                {t("product.price_per_kg_note", { price: formatSAR(product.price_per_kg) })}
              </p>
            )}
            <p className="mb-3 text-sm font-medium text-blue-700">
              {t("product.get_it_in")}
            </p>

            {product.product_variants.length > 0 ? (
              <ProductBuyBox
                variants={product.product_variants}
                stock={stock}
                isLoggedIn={isLoggedIn}
                storeId={product.store_id}
              />
            ) : (
              <p className="text-sm text-red-600">{t("product.currently_unavailable")}</p>
            )}
          </div>
        </div>
      </div>

      <ProductAlternatives
        storeId={product.store_id}
        products={alternativeProducts}
        ratings={Object.fromEntries(altRatingsMap)}
        stock={Object.fromEntries(altStockMap)}
      />

      <section id="reviews" className="mt-10 max-w-3xl scroll-mt-20">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="mb-1 text-lg font-semibold">{t("reviews.customer_reviews")}</h2>
            {rating ? (
              <StarRating rating={rating.avg_rating} count={rating.review_count} size="lg" />
            ) : (
              <p className="text-sm text-neutral-500">{t("reviews.be_first")}</p>
            )}
          </div>
          <ReviewForm productId={id} isLoggedIn={isLoggedIn} />
        </div>

        {reviews.length > 0 && (
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-neutral-100 pb-4 last:border-none">
                <div className="mb-1 flex items-center gap-2">
                  <StarRating rating={review.rating} />
                  <span className="text-sm font-medium">{review.reviewer_name ?? t("reviews.fastrack_customer")}</span>
                </div>
                {review.comment && <p className="text-sm text-neutral-600">{review.comment}</p>}
                <p className="mt-1 text-xs text-neutral-400">
                  {new Date(review.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10">
        <RecentlyViewed excludeProductId={id} />
      </div>
    </div>
  );
}
