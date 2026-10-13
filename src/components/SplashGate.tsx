"use client";

import { useEffect } from "react";

const MIN_SHOW_MS = 2500;
const GIVE_UP_MS = 9000;

/** Fades the loading screen (see AppSplash) away once the app has started, after it has been visible long enough to look intentional. */
export default function SplashGate() {
  useEffect(() => {
    const el = document.getElementById("ft-splash");
    if (!el) return;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      el.classList.add("ft-out");
      setTimeout(() => el.remove(), 500);
    };
    const wait = Math.max(0, MIN_SHOW_MS - performance.now());
    const arm = () => setTimeout(() => requestAnimationFrame(finish), wait);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (document.readyState === "complete") t = arm();
    else window.addEventListener("load", () => (t = arm()), { once: true });
    // Never leave a visitor staring at the splash if something is very slow.
    const giveUp = setTimeout(finish, GIVE_UP_MS);
    return () => {
      clearTimeout(giveUp);
      if (t) clearTimeout(t);
    };
  }, []);
  return null;
}
