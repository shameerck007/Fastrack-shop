import { notFound } from "next/navigation";
import AddToCartForm from "@/components/AddToCartForm";
import Breadcrumbs from "@/components/Breadcrumbs";
import StarRating from "@/components/StarRating";
import ReviewForm from "@/components/ReviewForm";
import TrackRecentlyViewed from "@/components/TrackRecentlyViewed";
import RecentlyViewed from "@/components/RecentlyViewed";
import { getProductById } from "@/lib/catalog";
import { getProductRating, getProductReviews } from "@/lib/reviews";
import { getVariantStockMap } from "@/lib/inventory";
import { formatSAR } from "@/lib/utils";
import { getCategoryTheme } from "@/lib/categoryTheme";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) notFound();

  const [rating, reviews, stockMap] = await Promise.all([
    getProductRating(id),
    getProductReviews(id),
    getVariantStockMap(product.product_variants.map((v) => v.id)),
  ]);
  const stock = Object.fromEntries(stockMap);

  const variant =
    product.product_variants.find((v) => v.is_default) ?? product.product_variants[0];
  const theme = getCategoryTheme(product.category?.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <TrackRecentlyViewed productId={id} />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          ...(product.category
            ? [{ label: product.category.name, href: `/categories/${product.category.slug}` }]
            : []),
          { label: product.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div
            className={`flex h-72 items-center justify-center rounded-2xl bg-gradient-to-br text-8xl lg:sticky lg:top-20 ${theme.gradient}`}
          >
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="h-full w-full rounded-2xl object-cover" />
            ) : (
              <span className="drop-shadow-sm">{theme.emoji}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm text-neutral-500">{product.brand}</p>
              {product.is_fresh && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Fresh
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            {product.name_ar && <p className="text-neutral-500" dir="rtl">{product.name_ar}</p>}
            {rating ? (
              <a href="#reviews" className="mt-1 inline-block">
                <StarRating rating={rating.avg_rating} count={rating.review_count} />
              </a>
            ) : (
              <p className="mt-1 text-xs text-neutral-400">No reviews yet</p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm text-neutral-600">
            {product.origin && (
              <>
                <dt className="font-medium">Origin</dt>
                <dd>{product.origin}</dd>
              </>
            )}
            {product.category && (
              <>
                <dt className="font-medium">Category</dt>
                <dd>{product.category.name}</dd>
              </>
            )}
          </dl>

          {product.description && (
            <div>
              <h2 className="mb-1 font-medium">About this item</h2>
              <p className="text-sm text-neutral-600">{product.description}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 lg:sticky lg:top-20">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700">
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
                {formatSAR(product.price_per_kg)}/kg — final price adjusted to packed weight
              </p>
            )}
            <p className="mb-3 text-sm font-medium text-emerald-700">
              ⚡ Get it in 15–60 minutes
            </p>

            {product.product_variants.length > 0 ? (
              <AddToCartForm variants={product.product_variants} stock={stock} />
            ) : (
              <p className="text-sm text-red-600">Currently unavailable.</p>
            )}
          </div>
        </div>
      </div>

      <section id="reviews" className="mt-10 max-w-3xl scroll-mt-20">
        <h2 className="mb-1 text-lg font-semibold">Customer Reviews</h2>
        {rating ? (
          <div className="mb-4">
            <StarRating rating={rating.avg_rating} count={rating.review_count} size="lg" />
          </div>
        ) : (
          <p className="mb-4 text-sm text-neutral-500">Be the first to review this product.</p>
        )}

        <div className="mb-6">
          <ReviewForm productId={id} />
        </div>

        {reviews.length > 0 && (
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-neutral-100 pb-4 last:border-none">
                <div className="mb-1 flex items-center gap-2">
                  <StarRating rating={review.rating} />
                  <span className="text-sm font-medium">{review.reviewer_name ?? "FasTrack customer"}</span>
                </div>
                {review.comment && <p className="text-sm text-neutral-600">{review.comment}</p>}
                <p className="mt-1 text-xs text-neutral-400">
                  {new Date(review.created_at).toLocaleDateString()}
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
