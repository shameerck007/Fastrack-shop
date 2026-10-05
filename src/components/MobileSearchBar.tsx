"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { smartBack } from "@/lib/nav-history";
import { useLocale } from "@/components/LocaleProvider";

/** Phone search screen top bar: round back button + search field (replaces the global header). */
export default function MobileSearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { t } = useLocale();
  const q = params.get("q") ?? "";

  return (
    <div
      className="sticky top-0 z-30 flex items-center gap-3 bg-white/95 px-4 pb-2.5 shadow-sm backdrop-blur md:hidden"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
    >
      <button
        type="button"
        onClick={() => smartBack(router, pathname)}
        aria-label={t("common.back")}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md ring-1 ring-black/5 transition active:scale-90"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-5 w-5 rtl:-scale-x-100">
          <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <form action="/search" className="min-w-0 flex-1">
        <input
          key={q}
          name="q"
          defaultValue={q}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={t("header.search_placeholder")}
          className="w-full rounded-full bg-neutral-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>
    </div>
  );
}
