"use client";

import { usePathname } from "next/navigation";

const HIDE_PREFIXES = ["/admin", "/rider", "/merchant", "/store", "/warehouse"];

export default function MobileNavGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Product pages swap the bottom tabs for their own sticky add-to-cart bar.
  const hide = HIDE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || pathname.startsWith("/products/");
  if (hide) return null;
  return <>{children}</>;
}
