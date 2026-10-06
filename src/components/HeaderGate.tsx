"use client";

import { usePathname } from "next/navigation";
import { isFullscreenMobileRoute } from "@/lib/mobile-fullscreen";

const HIDE_PREFIXES = ["/admin", "/platform", "/rider", "/merchant", "/store", "/warehouse"];

export default function HeaderGate({
  children,
  hideOnMobileFullscreen = false,
}: {
  children: React.ReactNode;
  hideOnMobileFullscreen?: boolean;
}) {
  const pathname = usePathname();
  const hide = HIDE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (hide) return null;
  if (hideOnMobileFullscreen && isFullscreenMobileRoute(pathname)) {
    return <div className="hidden md:contents">{children}</div>;
  }
  return <>{children}</>;
}
