"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { CategoryWithChildren } from "@/lib/catalog";

// Amazon/Noon-style: hovering a top-level category flies out its
// subcategories; clicking the category name still goes to its own page
// (which lists everything under it). A short close delay avoids the menu
// vanishing while the pointer crosses the small gap to the dropdown.
export default function CategoryNavBar({ categories }: { categories: CategoryWithChildren[] }) {
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
    <div className="mx-auto flex max-w-6xl items-center gap-4 overflow-x-auto px-4 py-2 text-sm text-blue-950">
      <Link href="/" className="shrink-0 font-medium hover:text-blue-700">
        All
      </Link>
      {categories.map((category) => (
        <div
          key={category.id}
          className="relative shrink-0"
          onMouseEnter={() => open(category.id)}
          onMouseLeave={scheduleClose}
        >
          <Link
            href={`/categories/${category.slug}`}
            className="flex items-center gap-1 whitespace-nowrap py-1 hover:text-blue-700"
          >
            {category.name}
            {category.children.length > 0 && (
              <span aria-hidden className="text-[9px] text-blue-400">
                ▾
              </span>
            )}
          </Link>

          {category.children.length > 0 && openId === category.id && (
            <div
              className="absolute left-0 top-full z-40 min-w-[13rem] rounded-xl border border-neutral-200 bg-white py-2 shadow-lg"
              onMouseEnter={() => open(category.id)}
              onMouseLeave={scheduleClose}
            >
              <Link
                href={`/categories/${category.slug}`}
                className="block whitespace-nowrap px-4 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                All {category.name}
              </Link>
              <div className="my-1 border-t border-neutral-100" />
              {category.children.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/categories/${sub.slug}`}
                  className="flex items-center gap-2 whitespace-nowrap px-4 py-1.5 text-sm text-neutral-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  {sub.icon && <span aria-hidden>{sub.icon}</span>}
                  {sub.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
      <Link href="/orders" className="shrink-0 whitespace-nowrap hover:text-blue-700">
        Buy Again
      </Link>
    </div>
  );
}
