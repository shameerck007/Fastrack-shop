"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// A thin blue bar across the top that starts the moment an internal link is tapped and finishes when the new page
// arrives: instant feedback that the tap was received (the same cue Instamart and Keeta give).
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (timer.current) clearTimeout(timer.current);
      setState("loading");
      // Never leave the bar hanging if the navigation fails.
      timer.current = setTimeout(() => setState("idle"), 15000);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname, search]);

  if (state === "idle") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[3500] h-[3px]" style={{ marginTop: "env(safe-area-inset-top)" }}>
      <div
        className={`h-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.7)] ${state === "loading" ? "animate-[navbar_12s_cubic-bezier(0.1,0.7,0.2,1)_forwards]" : "w-full opacity-0 transition-all duration-300"}`}
        style={state === "loading" ? undefined : { width: "100%" }}
      />
    </div>
  );
}
