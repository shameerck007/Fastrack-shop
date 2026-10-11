import { cache } from "react";
import { getCompanySettings } from "@/lib/company-settings";
import { getCurrentTenant } from "@/lib/tenant-server";
import { pricingFromSettings, type DeliveryPricing } from "@/lib/delivery-methods";

/** The delivery fees of the current market: the admin's settings over the built-in defaults. One lookup per request. */
export const getDeliveryPricing = cache(async (): Promise<DeliveryPricing> => {
  const [tenant, company] = await Promise.all([getCurrentTenant().catch(() => null), getCompanySettings().catch(() => null)]);
  return pricingFromSettings(tenant?.country_code, company);
});
