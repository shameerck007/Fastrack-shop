"use client";

import { usePathname } from "next/navigation";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";
import { showsCartBar } from "@/lib/mobile-fullscreen";

const HIDE_PREFIXES = ["/admin", "/platform", "/rider", "/merchant", "/store", "/warehouse"];

export default function MobileNavGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { cartCount } = useCustomerHeaderState();

  // Product pages swap the tabs for their own sticky add-to-cart bar, checkout
  // has its own Place order bar, and once something is in the cart the
  // Keeta-style checkout bar takes the bottom of the screen on browsing pages.
  const hide =
    HIDE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.startsWith("/products/") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname === "/cart" ||
    (cartCount > 0 && showsCartBar(pathname));
  if (hide) return null;
  return <>{children}</>;
}
