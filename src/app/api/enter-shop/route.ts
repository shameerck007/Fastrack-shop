import { NextResponse, type NextRequest } from "next/server";
import { SHOP_MODE_COOKIE } from "@/lib/landing";
import { createClient } from "@/lib/supabase/server";

/** "Back to shop" from a portal: remember (for this browser session) that the user
 * wants the shopping page, then send them there. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  // The cookie names the user who chose the shop, so it never applies to somebody else who signs in on the same browser.
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  response.cookies.set(SHOP_MODE_COOKIE, user?.id ?? "1", { path: "/", sameSite: "lax", httpOnly: true });
  return response;
}
