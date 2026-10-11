import { PageHeader } from "@/components/admin/AdminUi";
import DeliveryFeesForm from "@/components/admin/DeliveryFeesForm";
import { getCompanySettings } from "@/lib/company-settings";
import { getCurrentTenant } from "@/lib/tenant-server";
import { pricingFor } from "@/lib/delivery-methods";

export const metadata = { title: "Delivery fees" };

export default async function AdminDeliveryFeesPage() {
  const [company, tenant] = await Promise.all([getCompanySettings(), getCurrentTenant()]);
  const c = company as { delivery_fee_express?: number | null; delivery_fee_standard?: number | null; free_delivery_over?: number | null; free_delivery_enabled?: boolean | null };
  const defaults = pricingFor(tenant?.country_code);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon="🛵" title="Delivery fees" subtitle="What shoppers pay for delivery, and the order value above which it is free. Changes show in the shop, cart and checkout straight away." />
      <DeliveryFeesForm
        initial={{ express: c.delivery_fee_express ?? null, standard: c.delivery_fee_standard ?? null, freeOver: c.free_delivery_over ?? null, freeEnabled: c.free_delivery_enabled ?? true }}
        defaults={{ express: defaults.express, standard: defaults.standard, freeOver: defaults.freeOver }}
      />
    </div>
  );
}
