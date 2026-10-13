"use client";

import { usePathname } from "next/navigation";
import { isFullscreenMobileRoute } from "@/lib/mobile-fullscreen";

// Routes that already leave room for their own bottom bar (cart, checkout, product page) or show no bar at all (sign-in).
const HAS_OWN_ROOM = ["/cart", "/checkout", "/products", "/login", "/register"];

/**
 * On phones the account, orders, addresses, search and category pages hide the footer, and the footer is what normally leaves room at
 * the bottom for the fixed tab bar (and the floating cart bar). Without this empty space the last thing on the page, such as the
 * "Update password" button, sits underneath the tab bar and cannot be tapped. The space grows with the phone's home-indicator area.
 */
export default function MobileBottomSpacer() {
  const pathname = usePathname();
  if (!isFullscreenMobileRoute(pathname) || HAS_OWN_ROOM.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return <div className="h-[calc(6.5rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden />;
}
