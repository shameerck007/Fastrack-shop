"use client";

import { useEffect } from "react";

const RELOAD_GUARD_KEY = "fastrack:chunk-reload-at";
const GUARD_WINDOW_MS = 10_000;

// After a new deploy, a tab that's been open since before it can still hold
// references to JS chunks (e.g. the Server Action dispatch bundle) whose
// hashed filenames no longer exist on the server — any action on that page
// then fails with "Failed to fetch dynamically imported module". Vite
// fires `vite:preloadError` for exactly this; reloading once picks up the
// current deploy's files and the action just works. The guard prevents a
// reload loop if something else is genuinely broken.
function shouldReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    if (Date.now() - last < GUARD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

export default function ChunkErrorReload() {
  useEffect(() => {
    function onPreloadError() {
      if (shouldReload()) window.location.reload();
    }
    function onRejection(e: PromiseRejectionEvent) {
      const message = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "");
      if (/dynamically imported module/i.test(message) && shouldReload()) {
        window.location.reload();
      }
    }
    window.addEventListener("vite:preloadError", onPreloadError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("vite:preloadError", onPreloadError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
