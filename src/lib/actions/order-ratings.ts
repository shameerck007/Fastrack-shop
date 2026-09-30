"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitOrderRating(orderId: string, rating: number, comment: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  // The delivering rider, if any — captured now and stored on the rating
  // row so it stays attributed correctly regardless of what happens to the
  // assignment later. A no-rider order (e.g. cancelled-and-refunded edge
  // cases) just rates the order with no rider impact.
  const { data: assignment } = await supabase
    .from("delivery_assignments")
    .select("rider_id")
    .eq("order_id", orderId)
    .maybeSingle();

  // "customers rate own delivered orders" (insert) / "customers update own
  // order rating" (update) RLS policies are the real guard here — this only
  // decides which of the two to call, and surfaces a clean error instead of
  // a silent RLS rejection if the order isn't actually delivered/theirs.
  const { error } = await supabase.from("order_ratings").upsert(
    {
      order_id: orderId,
      user_id: user.id,
      rider_id: assignment?.rider_id ?? null,
      rating,
      comment: comment.trim() || null,
    },
    { onConflict: "order_id" }
  );

  if (error) {
    throw new Error("Could not submit your rating — this order may not be delivered yet.");
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}
