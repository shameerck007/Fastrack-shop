"use server";


import { UserError, failure } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export async function sendOrderMessage(orderId: string, body: string) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");

  const trimmed = body.trim();
  if (!trimmed) return;
  if (trimmed.length > 1000) throw new UserError("Message is too long.");

  const { error } = await supabase.from("order_messages").insert({
    order_id: orderId,
    sender_id: user.id,
    body: trimmed,
  });
  if (error) throw error;

  } catch (e) {
    return failure(e) as never;
  }
}
