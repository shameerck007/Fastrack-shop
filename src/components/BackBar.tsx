"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { isFullscreenMobileRoute } from "@/lib/mobile-fullscreen";

// Routes that have no page of their own (only /x/[id] exists), so "up one
// level" from them should skip to the next real ancestor.
const NON_PAGE_PATHS = new Set(["/categories", "/products", "/store", "/rider/orders", "/api"]);

// Portal sections (merchant/admin/rider) have their own chrome — a header
// with a single explicit "Back to shop" exit and a sidebar nav — so this
// generic bar would just be a second, redundant "back" control there.
const HIDE_PREFIXES = ["/admin", "/rider", "/merchant", "/store", "/warehouse"];

function parentPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  segments.pop();
  while (segments.length > 0 && NON_PAGE_PATHS.has("/" + segments.join("/"))) segments.pop();
  return segments.length === 0 ? "/" : "/" + segments.join("/");
}

// Navigation depth is module-level (not per-component) so any back button —
// this bar or a full-screen page's own round back button — behaves the same.
const nav = { depth: 0, popped: false, first: true };

export function smartBack(router: ReturnType<typeof useRouter>, pathname: string) {
  if (nav.depth > 0) router.back();
  else router.push(parentPath(pathname));
}

// Lives in the root layout so every page — for every role, and any page
// added later — gets a Back control without doing anything itself.
//
// It goes to the previous page when the user got here by navigating inside
// the app, and otherwise (direct link, refresh, new tab) to the page's
// logical parent, so it never throws someone out of the site.
export default function BackBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();

  useEffect(() => {
    const onPop = () => {
      nav.popped = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (nav.first) {
      nav.first = false;
      return;
    }
    if (nav.popped) {
      nav.depth = Math.max(0, nav.depth - 1);
      nav.popped = false;
    } else {
      nav.depth += 1;
    }
  }, [pathname]);

  if (pathname === "/" || HIDE_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  function goBack() {
    smartBack(router, pathname);
  }

  return (
    <div className={`border-b border-neutral-200 bg-white ${isFullscreenMobileRoute(pathname) ? "hidden md:block" : ""}`}>
      <div className="mx-auto flex max-w-6xl items-center px-2 py-1">
        <button
          type="button"
          onClick={goBack}
          aria-label={t("common.back")}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200"
        >
          <span aria-hidden className="text-lg leading-none rtl:-scale-x-100">←</span> {t("common.back")}
        </button>
      </div>
    </div>
  );
}
