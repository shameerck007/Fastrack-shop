import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMarketSummaries, PLATFORM_MARKET_COOKIE } from "@/lib/platform";

/** /platform has no country of its own: send the owner to the one they last looked at (or the first live one). */
export default async function PlatformIndexPage() {
  const markets = await getMarketSummaries();
  const last = (await cookies()).get(PLATFORM_MARKET_COOKIE)?.value;
  const pick = markets.find((m) => m.country_code.toLowerCase() === last) ?? markets.find((m) => m.status === "active") ?? markets[0];
  redirect(pick ? `/platform/${pick.country_code.toLowerCase()}` : "/platform/markets");
}
