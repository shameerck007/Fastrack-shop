"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateRiderLocation(lat: number, lng: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const { error } = await supabase
    .from("delivery_partners")
    .update({ current_lat: lat, current_lng: lng })
    .eq("id", user.id);
  if (error) throw error;
}
