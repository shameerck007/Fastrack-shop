"use server";

import { createClient } from "@/lib/supabase/server";
import { getMyNotifications, getUnreadNotificationCount, type NotificationRow } from "@/lib/notifications";

export async function fetchNotifications(): Promise<{ items: NotificationRow[]; unreadCount: number }> {
  const [items, unreadCount] = await Promise.all([getMyNotifications(), getUnreadNotificationCount()]);
  return { items, unreadCount };
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  return getUnreadNotificationCount();
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) throw error;
}
