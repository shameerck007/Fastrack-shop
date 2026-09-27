"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Routes that have no page of their own (only /x/[id] exists), so "up one
// level" from them should skip to the next real ancestor.
const NON_PAGE_PATHS = new Set(["/categories", "/products", "/store", "/rider/orders", "/api"]);

function parentPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  segments.pop();
  while (segments.length > 0 && NON_PAGE_PATHS.has("/" + segments.join("/"))) segments.pop();
  return segments.length === 0 ? "/" : "/" + segments.join("/");
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
  const depth = useRef(0);
  const popped = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (popped.current) {
      depth.current = Math.max(0, depth.current - 1);
      popped.current = false;
    } else {
      depth.current += 1;
    }
  }, [pathname]);

  if (pathname === "/") return null;

  function goBack() {
    if (depth.current > 0) router.back();
    else router.push(parentPath(pathname));
  }

  return (
    <div className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center px-2 py-1">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200"
        >
          <span aria-hidden className="text-lg leading-none">←</span> Back
        </button>
      </div>
    </div>
  );
}
