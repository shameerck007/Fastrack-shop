"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addReview(productId: string, rating: number, comment: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in to write a review.");

  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("reviews").insert({
    product_id: productId,
    user_id: user.id,
    rating,
    comment: comment.trim() || null,
    reviewer_name: profile?.full_name ?? "FasTrack customer",
  });

  if (error) throw error;
  revalidatePath(`/products/${productId}`);
}
