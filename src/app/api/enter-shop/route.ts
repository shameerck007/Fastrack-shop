import { NextResponse, type NextRequest } from "next/server";
import { SHOP_MODE_COOKIE } from "@/lib/landing";

/** "Back to shop" from a portal: remember (for this browser session) that the user
 * wants the shopping page, then send them there. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SHOP_MODE_COOKIE, "1", { path: "/", sameSite: "lax", httpOnly: true });
  return response;
}
