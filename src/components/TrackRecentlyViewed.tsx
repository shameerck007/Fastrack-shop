"use client";

import { useEffect } from "react";

const STORAGE_KEY = "ft_recently_viewed";
const MAX_ITEMS = 10;

export default function TrackRecentlyViewed({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const next = [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage unavailable (private browsing, blocked storage) — skip silently.
    }
  }, [productId]);

  return null;
}
