import { marketUi, type MarketUi } from "@/lib/market-ui";
import { getCompanySettings } from "@/lib/company-settings";
import { getCurrentTenant } from "@/lib/tenant-server";

/** How the storefront looks in the current market, with the admin's Shops switch applied (Business settings > Storefront). */
export async function getMarketUi(): Promise<MarketUi> {
  const [tenant, settings] = await Promise.all([getCurrentTenant().catch(() => null), getCompanySettings().catch(() => null)]);
  return marketUi(tenant?.country_code, settings?.show_shops ?? null);
}
