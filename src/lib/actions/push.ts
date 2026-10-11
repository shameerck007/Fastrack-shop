"use server";


import { UserError, failure } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export async function getVapidPublicKey(): Promise<string | null> {
  try {
  return await process.env.VAPID_PUBLIC_KEY ?? null;

  } catch (e) {
    return failure(e) as never;
  }
}

export async function subscribeToPush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      { onConflict: "endpoint" }
    );
  if (error) throw error;

  } catch (e) {
    return failure(e) as never;
  }
}

export async function unsubscribeFromPush(endpoint: string) {
  try {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw error;

  } catch (e) {
    return failure(e) as never;
  }
}
