import Link from "next/link";
import { getHomeOffers } from "@/lib/home-offers";
import { getMoney } from "@/lib/tenant-server";
import { getServerLocale } from "@/lib/i18n/get-locale";

/** The admin's live offers and coupons as small promo cards above the discounted products. */
export default async function HomeOffers() {
  const offers = await getHomeOffers();
  if (offers.length === 0) return null;
  const money = await getMoney();
  const ar = (await getServerLocale()) === "ar";

  return (
    <section className="mb-5">
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
        {offers.map((o) => {
          const headline =
            o.kind === "free_delivery" ? "Free delivery" : o.kind === "percent" ? `${o.value}% off` : `${money(o.value)} off`;
          const detail = [
            o.minOrder ? `on orders over ${money(o.minOrder)}` : null,
            o.kind === "percent" && o.maxDiscount ? `up to ${money(o.maxDiscount)}` : null,
            o.firstOrderOnly ? "first order only" : null,
          ].filter(Boolean).join(" · ");
          const href = o.categorySlug ? `/categories/${o.categorySlug}` : o.storeId ? `/store/${o.storeId}` : "/categories";
          const ends = o.endsAt ? new Date(o.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
          return (
            <Link key={o.id} href={href} className="flex w-64 shrink-0 flex-col gap-1 rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-4 transition hover:shadow-md">
              <span className="text-xl font-extrabold text-orange-700">{headline}</span>
              <span className="text-sm font-semibold text-neutral-900">{ar && o.nameAr ? o.nameAr : o.name}</span>
              {detail && <span className="text-xs text-neutral-500">{detail}</span>}
              <span className="mt-1 flex items-center gap-2 text-xs">
                {o.code ? (
                  <span className="rounded-md border border-dashed border-orange-400 bg-white px-2 py-0.5 font-mono font-bold tracking-wide text-orange-800">{o.code}</span>
                ) : (
                  <span className="font-semibold text-emerald-700">Applied automatically</span>
                )}
                {ends && <span className="text-neutral-400">Ends {ends}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
