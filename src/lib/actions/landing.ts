"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SHOP_MODE_COOKIE } from "@/lib/landing";

/** Saves where the user wants to land when they open the app. Returns an error value (not a throw) so the message survives production. */
export async function setLandingPreference(choice: "portal" | "shop"): Promise<{ error?: string }> {
  if (choice !== "portal" && choice !== "shop") return { error: "Choose a landing page." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const { error } = await supabase.from("profiles").update({ landing_page: choice }).eq("id", user.id);
  if (error) {
    return {
      error: error.code === "42703" || error.code === "PGRST204" ? "This setting isn't available yet — please try again later." : error.message,
    };
  }

  // Picking "portal" should take effect right away, not after the shop-mode
  // session cookie from an earlier "Back to shop" expires.
  if (choice === "portal") (await cookies()).delete(SHOP_MODE_COOKIE);

  revalidatePath("/account");
  return {};
}
