"use client";

import { useRef, useState } from "react";
import Link from "@/components/Link";
import ScrollRow from "@/components/ScrollRow";
import type { CategoryWithChildren } from "@/lib/catalog";
import { categoryImageUrl, getCategoryTheme } from "@/lib/categoryTheme";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName } from "@/lib/i18n/localized";

// Amazon/Noon-style: the home page shows only main categories; hovering a
// tile flies out its subcategories instead of navigating away immediately.
export default function CategoryGrid({ categories }: { categories: CategoryWithChildren[] }) {
  const { t, locale } = useLocale();
  const [openId, setOpenId] = useState<string | null>(null);
  // The row scrolls sideways, so the sub-category fly-out is placed on the page (fixed) under the tile instead of inside the row.
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function open(id: string, el?: HTMLElement | null) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (el) {
      const r = el.getBoundingClientRect();
      setAnchor({ left: r.left + r.width / 2, top: r.bottom + 4 });
    }
    setOpenId(id);
  }
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenId(null), 150);
  }

  return (
    <ScrollRow className="-mx-4 md:mx-0" innerClassName="gap-4 px-4 pb-1 md:gap-5 md:px-1">
      {categories.map((category) => {
        const theme = getCategoryTheme(category.slug);
        const hasChildren = category.children.length > 0;
        return (
          <div
            key={category.id}
            className="relative w-[4.75rem] shrink-0 snap-start sm:w-[5.5rem] md:w-24"
            onMouseEnter={(e) => hasChildren && open(category.id, e.currentTarget)}
            onMouseLeave={scheduleClose}
          >
            <Link href={`/categories/${category.slug}`} className="group flex flex-col items-center gap-2">
              <div className="h-[4.5rem] w-[4.5rem] overflow-hidden rounded-full shadow-sm ring-2 ring-white transition group-hover:-translate-y-0.5 group-hover:shadow-md group-active:scale-95 sm:h-20 sm:w-20 md:mx-auto">
                {categoryImageUrl(category) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={categoryImageUrl(category) as string} alt={category.name} className="h-full w-full object-cover" />
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-3xl sm:text-4xl ${theme.gradient}`}
                  >
                    <span className="drop-shadow-sm">{category.icon || theme.emoji}</span>
                  </div>
                )}
              </div>
              <span className="flex max-w-full items-center justify-center gap-0.5 whitespace-nowrap text-center text-xs font-semibold text-neutral-800 sm:text-sm">
                <span className="truncate">{localizedName(category, locale)}</span>
                {hasChildren && (
                  <span aria-hidden className="text-[8px] text-neutral-400">
                    ▾
                  </span>
                )}
              </span>
            </Link>

            {hasChildren && openId === category.id && anchor && (
              <div
                style={{ position: "fixed", left: anchor.left, top: anchor.top }}
                className="z-40 hidden min-w-[12rem] -translate-x-1/2 rounded-xl border border-neutral-200 bg-white py-2 shadow-lg md:block"
                onMouseEnter={() => open(category.id)}
                onMouseLeave={scheduleClose}
              >
                <Link
                  href={`/categories/${category.slug}`}
                  className="block whitespace-nowrap px-4 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  {t("category.all_of", { name: localizedName(category, locale) })}
                </Link>
                <div className="my-1 border-t border-neutral-100" />
                {category.children.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/categories/${sub.slug}`}
                    className="flex items-center gap-2 whitespace-nowrap px-4 py-1.5 text-sm text-neutral-700 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {sub.icon && <span aria-hidden>{sub.icon}</span>}
                    {localizedName(sub, locale)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </ScrollRow>
  );
}
