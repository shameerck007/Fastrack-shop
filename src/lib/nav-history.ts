import type { useRouter } from "next/navigation";

// Routes that have no page of their own (only /x/[id] exists), so "up one
// level" from them should skip to the next real ancestor.
const NON_PAGE_PATHS = new Set(["/categories", "/products", "/store", "/rider/orders", "/api"]);

export function parentPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  segments.pop();
  while (segments.length > 0 && NON_PAGE_PATHS.has("/" + segments.join("/"))) segments.pop();
  return segments.length === 0 ? "/" : "/" + segments.join("/");
}

// Navigation depth is module-level (not per-component) so every back button
// in the app — the desktop bar, the mobile title bar, and the round buttons
// on full-screen product/category pages — behaves identically: back to the
// previous page when the shopper navigated here inside the app, otherwise
// up to the page's logical parent so it never throws them out of the site.
export const nav = { depth: 0, popped: false, first: true };

export function smartBack(router: ReturnType<typeof useRouter>, pathname: string) {
  if (nav.depth > 0) router.back();
  else router.push(parentPath(pathname));
}
