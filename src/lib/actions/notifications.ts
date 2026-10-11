"use server";


import { failure } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { getMyNotifications, getUnreadNotificationCount, type NotificationRow } from "@/lib/notifications";

export async function fetchNotifications(): Promise<{ items: NotificationRow[]; unreadCount: number }> {
  try {
  const [items, unreadCount] = await Promise.all([getMyNotifications(), getUnreadNotificationCount()]);
  return await { items, unreadCount };

  } catch (e) {
    return failure(e) as never;
  }
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  try {
  return await getUnreadNotificationCount();

  } catch (e) {
    return failure(e) as never;
  }
}

export async function markNotificationRead(id: string) {
  try {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;

  } catch (e) {
    return failure(e) as never;
  }
}

export async function markAllNotificationsRead() {
  try {
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

  } catch (e) {
    return failure(e) as never;
  }
}
