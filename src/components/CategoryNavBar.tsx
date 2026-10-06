"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import type { CategoryWithChildren } from "@/lib/catalog";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName } from "@/lib/i18n/localized";

// Amazon/Noon-style: hovering a top-level category flies out its
// subcategories; clicking the category name still goes to its own page
// (which lists everything under it). A short close delay avoids the menu
// vanishing while the pointer crosses the small gap to the dropdown.
//
// The row itself scrolls horizontally on small screens (overflow-x-auto),
// and CSS forces a scrollable axis to clip the other axis too — so an
// absolutely-positioned dropdown nested inside that row gets silently cut
// off. We render the flyout as a `position: fixed` panel anchored to the
// hovered item's on-screen position instead, which escapes that clipping.
export default function CategoryNavBar({ categories }: { categories: CategoryWithChildren[] }) {
  const { t, locale } = useLocale();
  const [openId, setOpenId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<{ left: number; top: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function open(id: string, target: HTMLElement) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const rect = target.getBoundingClientRect();
    setAnchorRect({ left: rect.left, top: rect.bottom });
    setOpenId(id);
  }
  function keepOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenId(null), 150);
  }

  // A scroll or resize can invalidate the anchored position (or move the
  // trigger out of view entirely), so just close the flyout rather than
  // let it float somewhere wrong.
  useEffect(() => {
    if (!openId) return;
    const close = () => setOpenId(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openId]);

  const openCategory = categories.find((c) => c.id === openId);

  return (
    <div className="mx-auto flex max-w-6xl items-center gap-4 overflow-x-auto px-4 py-2 text-sm text-blue-950">
      <Link href="/" className="shrink-0 font-medium hover:text-blue-700">
        {t("header.all")}
      </Link>
      {categories.map((category) => (
        <div
          key={category.id}
          className="relative shrink-0"
          onMouseEnter={(e) => open(category.id, e.currentTarget)}
          onMouseLeave={scheduleClose}
        >
          <Link
            href={`/categories/${category.slug}`}
            className="flex items-center gap-1 whitespace-nowrap py-1 hover:text-blue-700"
          >
            {localizedName(category, locale)}
            {category.children.length > 0 && (
              <span aria-hidden className="text-[9px] text-blue-400">
                ▾
              </span>
            )}
          </Link>
        </div>
      ))}
      <Link href="/orders" className="shrink-0 whitespace-nowrap hover:text-blue-700">
        {t("header.buy_again")}
      </Link>

      {openCategory && openCategory.children.length > 0 && anchorRect && (
        <div
          style={{ position: "fixed", left: anchorRect.left, top: anchorRect.top }}
          className="z-[2000] min-w-[13rem] rounded-xl border border-neutral-200 bg-white py-2 shadow-lg"
          onMouseEnter={keepOpen}
          onMouseLeave={scheduleClose}
        >
          <Link
            href={`/categories/${openCategory.slug}`}
            className="block whitespace-nowrap px-4 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            {t("category.all_of", { name: localizedName(openCategory, locale) })}
          </Link>
          <div className="my-1 border-t border-neutral-100" />
          {openCategory.children.map((sub) => (
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
}
