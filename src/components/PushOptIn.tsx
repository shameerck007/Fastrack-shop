"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getVapidPublicKey, subscribeToPush } from "@/lib/actions/push";
import { useLocale } from "@/components/LocaleProvider";

const DISMISSED_KEY = "fastrack:push-opt-in-dismissed";

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function ensureSubscribed(vapidPublicKey: string) {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
    await subscribeToPush({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
  }
}

// iPadOS 13+ reports as a Mac in the UA string — the reliable tell is
// touch support, which no real Mac has.
function isIOSDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// Apple only supports Web Push for a site added to the Home Screen — a
// plain Safari tab (even on iOS 16.4+) can't subscribe at all, silently.
// This is the standard way to detect "running as the installed PWA".
function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

type Mode = "default" | "ios_install";

export default function PushOptIn() {
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>("default");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined") return;

      try {
        if (localStorage.getItem(DISMISSED_KEY)) return;
      } catch {
        /* ignore */
      }

      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!user || cancelled) return;

      if (isIOSDevice() && !isStandalone()) {
        if (!cancelled) {
          setMode("ios_install");
          setVisible(true);
        }
        return;
      }

      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey || cancelled) return;

      if (Notification.permission === "granted") {
        ensureSubscribed(vapidPublicKey).catch(() => {
          /* best-effort background sync — no UI for a silent failure here */
        });
        return;
      }

      if (Notification.permission === "denied") return;

      if (!cancelled) {
        setMode("default");
        setVisible(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey) throw new Error("Notifications aren't set up yet.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }
      await ensureSubscribed(vapidPublicKey);
      setVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("push.could_not_enable"));
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!visible) return null;

  if (mode === "ios_install") {
    return (
      <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-sm px-4 md:bottom-4">
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg">
          <span className="text-2xl">📲</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-neutral-900">{t("push.ios_install_title")}</p>
            <p className="text-xs text-neutral-500">{t("push.ios_install_hint")}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-full bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800"
          >
            {t("push.got_it")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-sm px-4 md:bottom-4">
      <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg">
        <span className="text-2xl">🔔</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900">{t("push.enable_title")}</p>
          <p className="text-xs text-neutral-500">{t("push.enable_hint")}</p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="rounded-full bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? t("common.saving") : t("push.enable")}
          </button>
          <button type="button" onClick={dismiss} className="text-xs text-neutral-400 hover:text-neutral-600">
            {t("push.not_now")}
          </button>
        </div>
      </div>
    </div>
  );
}
