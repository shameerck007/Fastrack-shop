"use client";

import { Suspense, useEffect } from "react";
import MobileSearchBar from "@/components/MobileSearchBar";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { hasOwnMobileTopBar, isFullscreenMobileRoute } from "@/lib/mobile-fullscreen";
import { nav, smartBack } from "@/lib/nav-history";
import AutoBreadcrumbs from "@/components/AutoBreadcrumbs";

// Portal sections (merchant/admin/rider) have their own chrome — a header
// with a single explicit "Back to shop" exit and a sidebar nav — so this
// generic bar would just be a second, redundant "back" control there.
const HIDE_PREFIXES = ["/admin", "/platform", "/rider", "/merchant", "/store", "/warehouse"];

// Page titles for the phone top bar (translation keys).
const TITLE_KEYS: [string, string][] = [
  ["/cart", "cart.title"],
  ["/checkout", "checkout.title"],
  ["/orders", "orders.title"],
  ["/account", "account.title"],
  ["/addresses", "addresses.title"],
  ["/login", "auth.sign_in_title"],
  ["/register", "auth.create_account_title"],
];

function titleKeyFor(pathname: string): string | null {
  return TITLE_KEYS.find(([p]) => pathname === p || pathname.startsWith(p + "/"))?.[1] ?? null;
}

// Lives in the root layout so every page gets its navigation without doing anything itself.
//
// Desktop: breadcrumbs (Home / Your account / ...) instead of a "Back" strip. Phones: a Keeta-style slim title bar
// with a round back button on the full-screen pages (product/category pages draw their own), because an installed
// phone app has no browser back button.
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

  const fullscreen = isFullscreenMobileRoute(pathname);
  const ownBar = hasOwnMobileTopBar(pathname);
  const titleKey = titleKeyFor(pathname);

  function goBack() {
    smartBack(router, pathname);
  }

  return (
    <>
      {pathname === "/search" && (
        <Suspense fallback={null}>
          <MobileSearchBar />
        </Suspense>
      )}
      {fullscreen && !ownBar && (
        <div
          className="sticky top-0 z-30 flex items-center gap-3 bg-white/95 px-4 pb-2.5 shadow-sm backdrop-blur md:hidden"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
        >
          <button
            type="button"
            onClick={goBack}
            aria-label={t("common.back")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md ring-1 ring-black/5 transition active:scale-90"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-5 w-5 rtl:-scale-x-100">
              <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {titleKey && <span className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight">{t(titleKey)}</span>}
        </div>
      )}

      <AutoBreadcrumbs pathname={pathname} desktopOnly={fullscreen} />
    </>
  );
}
