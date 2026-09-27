"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { CategoryWithChildren } from "@/lib/catalog";
import { getCategoryTheme } from "@/lib/categoryTheme";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName } from "@/lib/i18n/localized";

// Amazon/Noon-style: the home page shows only main categories; hovering a
// tile flies out its subcategories instead of navigating away immediately.
export default function CategoryGrid({ categories }: { categories: CategoryWithChildren[] }) {
  const { t, locale } = useLocale();
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function open(id: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenId(id);
  }
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenId(null), 150);
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-9">
      {categories.map((category) => {
        const theme = getCategoryTheme(category.slug);
        const hasChildren = category.children.length > 0;
        return (
          <div
            key={category.id}
            className="relative"
            onMouseEnter={() => hasChildren && open(category.id)}
            onMouseLeave={scheduleClose}
          >
            <Link href={`/categories/${category.slug}`} className="group flex flex-col items-center gap-2">
              <div className="h-16 w-16 overflow-hidden rounded-2xl shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-20 sm:w-20">
                {category.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={category.image_url} alt={category.name} className="h-full w-full object-cover" />
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-3xl sm:text-4xl ${theme.gradient}`}
                  >
                    <span className="drop-shadow-sm">{category.icon || theme.emoji}</span>
                  </div>
                )}
              </div>
              <span className="flex items-center gap-0.5 text-center text-xs font-medium text-neutral-700 sm:text-sm">
                {localizedName(category, locale)}
                {hasChildren && (
                  <span aria-hidden className="text-[8px] text-neutral-400">
                    ▾
                  </span>
                )}
              </span>
            </Link>

            {hasChildren && openId === category.id && (
              <div
                className="absolute left-1/2 top-full z-40 mt-1 min-w-[12rem] -translate-x-1/2 rounded-xl border border-neutral-200 bg-white py-2 shadow-lg"
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
    </div>
  );
}
