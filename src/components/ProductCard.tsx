"use client";

import Link from "@/components/Link";
import type { ProductWithVariants } from "@/types/database";

import { getCategoryTheme } from "@/lib/categoryTheme";
import StarRating from "@/components/StarRating";
import type { ProductRating } from "@/lib/reviews";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName, localizedField } from "@/lib/i18n/localized";
import QuickAddToCart from "@/components/QuickAddToCart";
import { SoldBy, ClosedOverlay } from "@/components/StoreBadge";
import { useStoreInfo } from "@/components/StoreDirectoryProvider";
import { useMarket } from "@/components/MoneyProvider";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import { marketUi } from "@/lib/market-ui";
import { formatEta } from "@/lib/eta";
import { marketOffsetMinutes } from "@/lib/timezone";
import { formatDeliveryDate, standardDeliveryDate } from "@/lib/delivery-methods";

import { useMoney } from "@/components/MoneyProvider";

export default function ProductCard({
  product,
  rating,
  stock,
}: {
  product: ProductWithVariants;
  rating?: ProductRating;
  stock?: number;
}) {
  const money = useMoney();
  const { t, locale } = useLocale();

  const variant =
    product.product_variants.find((v) => v.is_default) ?? product.product_variants[0];
  const theme = getCategoryTheme(product.category?.slug);
  const discountPct =
    variant?.compare_at_price && variant.compare_at_price > variant.price
      ? Math.round((1 - variant.price / variant.compare_at_price) * 100)
      : null;
  const outOfStock = stock !== undefined && stock <= 0;
  const { status: storeStatus } = useStoreInfo(product.store_id);
  const countryCode = useMarket().countryCode;
  const ui = marketUi(countryCode);
  const deliveryCtx = useDeliveryLocation();
  const delivery = deliveryCtx.statusForStore(product.store_id ?? null);
  const etaRangeForCard = deliveryCtx.etaForStore(product.store_id ?? null);
  const storeClosed = !!storeStatus && !storeStatus.open;
  const name = locale === "ar" ? localizedName(product, "ar") : product.name;

  return (
    <Link
      href={`/products/${product.id}`}
      className={`group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-neutral-100 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-neutral-300/50 active:scale-[0.98] ${
        outOfStock || storeClosed ? "opacity-60" : ""
      }`}
    >
      <div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${theme.gradient}`}>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={name} className={`h-full w-full object-cover ${storeClosed ? "grayscale" : ""}`} />
        ) : (
          <span className="text-5xl drop-shadow-sm transition group-hover:scale-110">
            {theme.emoji}
          </span>
        )}

        <div className="absolute start-2 top-2 flex flex-col gap-1">
          {product.is_fresh && (
            <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 shadow-sm">
              {locale === "ar" ? "طازج" : "Fresh"}
            </span>
          )}
        </div>
        {outOfStock ? (
          <span className="absolute end-2 top-2 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            {t("product.out_of_stock")}
          </span>
        ) : (
          discountPct && (
            <span className="absolute end-2 top-2 rounded-full bg-blue-700 px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
              -{discountPct}%
            </span>
          )
        )}
        {storeClosed && !outOfStock && <ClosedOverlay status={storeStatus} />}
        {variant && !outOfStock && !storeClosed && (
          <QuickAddToCart variantId={variant.id} storeId={product.store_id} stock={stock ?? Infinity} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        {product.store_id && ui.soldByOnCards && <SoldBy storeId={product.store_id} className="mb-0.5" />}
        <span className="text-xs text-neutral-500">{localizedField(product.brand, product.brand_ar, locale)}</span>
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900">{name}</span>
        {rating && rating.review_count > 0 && (
          <StarRating rating={rating.avg_rating} count={rating.review_count} />
        )}
        {variant && (
          <span className="text-xs text-neutral-500">{localizedField(variant.label, variant.label_ar, locale)}</span>
        )}
        {ui.deliveryBadges && delivery.state === "ok" && !outOfStock && (
          <span className={`mt-0.5 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${delivery.express ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600"}`}>
            {delivery.express
              ? `${etaRangeForCard ? formatEta(etaRangeForCard) : "Express"}`
              : `📦 ${formatDeliveryDate(standardDeliveryDate(delivery.standardDays, new Date(), marketOffsetMinutes(countryCode)), locale)}`}
          </span>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-extrabold text-neutral-900">
              {variant ? money(variant.price) : "—"}
            </span>
            {variant?.compare_at_price && (
              <span className="text-xs text-neutral-400 line-through">
                {money(variant.compare_at_price)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
