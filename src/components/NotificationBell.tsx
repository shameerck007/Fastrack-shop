"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";
import { useLocale } from "@/components/LocaleProvider";
import type { NotificationRow } from "@/lib/notifications";

const POLL_MS = 45000;

function relativeTime(iso: string, locale: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  if (diffMin < 1) return rtf.format(0, "minute");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  return rtf.format(-Math.round(diffHr / 24), "day");
}

export default function NotificationBell() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUnreadNotificationCount()
      .then((n) => {
        if (!cancelled) setUnreadCount(n);
      })
      .catch(() => {
        /* not signed in, or transient — badge just stays at 0 */
      });
    const interval = setInterval(() => {
      fetchUnreadNotificationCount()
        .then((n) => {
          if (!cancelled) setUnreadCount(n);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const { items: rows, unreadCount: n } = await fetchNotifications();
      setItems(rows);
      setUnreadCount(n);
      if (n > 0) {
        markAllNotificationsRead()
          .then(() => setUnreadCount(0))
          .catch(() => {});
      }
    }
  }

  function openItem(item: NotificationRow) {
    setOpen(false);
    if (item.url) router.push(item.url);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t("notifications.title")}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-lg hover:bg-neutral-100"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700">
            {t("notifications.title")}
          </div>
          {items === null ? (
            <p className="p-4 text-sm text-neutral-400">{t("notifications.loading")}</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-400">{t("notifications.empty")}</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={`block w-full border-b border-neutral-50 px-4 py-3 text-start transition hover:bg-neutral-50 ${
                    !item.read_at ? "bg-blue-50/40" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-neutral-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{item.body}</p>
                  <p className="mt-1 text-[11px] text-neutral-400">{relativeTime(item.created_at, locale)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
