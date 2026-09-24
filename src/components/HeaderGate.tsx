"use client";

import { usePathname } from "next/navigation";

const HIDE_PREFIXES = ["/admin", "/rider", "/merchant"];

export default function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hide = HIDE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (hide) return null;
  return <>{children}</>;
}
