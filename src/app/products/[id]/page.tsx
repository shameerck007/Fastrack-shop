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

import { getCategoryTheme } from "@/lib/categoryTheme";
import { createClient } from "@/lib/supabase/server";
import { isProductWishlisted } from "@/lib/wishlist";
import WishlistButton from "@/components/WishlistButton";
import { ProductTopBar } from "@/components/MobileTopBar";
import { PlaceOrderPill } from "@/components/FloatingCartBar";
import { SoldBy, ClosedBanner } from "@/components/StoreBadge";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { localizedName, localizedField } from "@/lib/i18n/localized";
import { getMoney } from "@/lib/tenant-server";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const money = await getMoney();
  const { id } = await params;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const product = await getProductById(id);

  if (!product) notFound();

  const supabase = await createClient();
  const [rating, reviews, stockMap, { data: { user } }, wishlisted] = await Promise.all([
    getProductRating(id),
    getProductReviews(id),
    getVariantStockMap(product.product_variants.map((v) => v.id)),
    supabase.auth.getUser(),
    isProductWishlisted(id),
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
    <div className="mx-auto max-w-6xl px-4 py-6 max-md:px-0 max-md:pb-56 max-md:pt-0">
      <TrackRecentlyViewed productId={id} />
      <ProductTopBar>
        <WishlistButton productId={product.id} initialInList={wishlisted} />
      </ProductTopBar>
      <div className="hidden md:block">
      <Breadcrumbs
        items={[
          { label: t("category.home"), href: "/" },
          ...(product.category
            ? [{ label: localizedName(product.category, locale), href: `/categories/${product.category.slug}` }]
            : []),
          { label: productName },
        ]}
      />
      </div>

      <div className="grid gap-8 max-md:gap-0 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div
            className={`relative flex h-72 items-center justify-center rounded-2xl bg-gradient-to-br text-8xl max-md:h-[22rem] max-md:rounded-none lg:sticky lg:top-20 ${theme.gradient}`}
          >
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={productName} className="h-full w-full rounded-2xl object-cover max-md:rounded-none" />
            ) : (
              <span className="drop-shadow-sm">{theme.emoji}</span>
            )}
            <div className="absolute end-3 top-3 max-md:hidden">
              <WishlistButton productId={product.id} initialInList={wishlisted} />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-4 max-md:-mt-7 max-md:rounded-t-3xl max-md:bg-neutral-50 max-md:px-4 max-md:pt-6 lg:col-span-4">
          <div>
            {product.store_id && <SoldBy storeId={product.store_id} linked className="mb-2 text-sm" />}
            {product.store_id && <ClosedBanner storeId={product.store_id} className="mb-3" />}
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm text-neutral-500">{localizedField(product.brand, product.brand_ar, locale)}</p>
              {product.is_fresh && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  {locale === "ar" ? "طازج" : "Fresh"}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">{productName}</h1>
            {rating ? (
              <a href="#reviews" className="mt-1 inline-block">
                <StarRating rating={rating.avg_rating} count={rating.review_count} />
              </a>
            ) : (
              <p className="mt-1 text-xs text-neutral-400">{t("product.no_reviews_yet")}</p>
            )}
          </div>

          <div className="md:hidden">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-neutral-900">
                {variant ? money(variant.price) : "—"}
              </span>
              {variant?.compare_at_price && (
                <span className="text-base text-neutral-400 line-through">{money(variant.compare_at_price)}</span>
              )}
            </div>
            {product.is_variable_weight && product.price_per_kg && (
              <p className="mt-1 text-xs text-neutral-500">
                {t("product.price_per_kg_note", { price: money(product.price_per_kg) })}
              </p>
            )}
            <p className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {t("product.get_it_in")}
            </p>
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
          <div
            className="rounded-2xl border border-neutral-200 bg-white p-4 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:rounded-b-none max-md:rounded-t-3xl max-md:border-x-0 max-md:border-b-0 max-md:px-4 max-md:pt-3 max-md:shadow-[0_-8px_24px_rgba(0,0,0,0.08)] lg:sticky lg:top-20"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <PlaceOrderPill compact className="mb-3 md:hidden" />
            <div className="mb-2 flex items-baseline gap-2 max-md:hidden">
              <span className="text-2xl font-bold text-blue-700">
                {variant ? money(variant.price) : "—"}
              </span>
              {variant?.compare_at_price && (
                <span className="text-neutral-400 line-through">
                  {money(variant.compare_at_price)}
                </span>
              )}
            </div>
            {product.is_variable_weight && product.price_per_kg && (
              <p className="mb-2 text-xs text-neutral-500 max-md:hidden">
                {t("product.price_per_kg_note", { price: money(product.price_per_kg) })}
              </p>
            )}
            <p className="mb-3 text-sm font-medium text-blue-700 max-md:hidden">
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

      <div className="max-md:bg-neutral-50 max-md:px-4">
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
    </div>
  );
}
