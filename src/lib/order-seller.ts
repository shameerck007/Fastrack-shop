import { createClient } from "@/lib/supabase/server";
import { getCompanySettings, type CompanySettings } from "@/lib/company-settings";

// Amazon/noon-style marketplace invoicing: an order fulfilled from a
// merchant's own warehouse shows that merchant's own trading name/CR/VAT
// as the seller, not FasTrack's. Orders fulfilled from a FasTrack-owned
// warehouse (no store references it) fall back to company_settings, same
// as before this existed. get_store_billing_by_warehouse() only returns a
// row for an approved store's own warehouse.
export async function getOrderSeller(warehouseId: string | null): Promise<CompanySettings> {
  if (warehouseId) {
    const supabase = await createClient();
    const { data } = await supabase
      .rpc("get_store_billing_by_warehouse", { target_warehouse_id: warehouseId })
      .maybeSingle();
    const row = data as {
      name: string;
      cr_number: string | null;
      vat_number: string | null;
      address_line: string | null;
      city: string | null;
      contact_phone: string | null;
      state?: string | null;
    } | null;
    if (row) {
      return {
        trading_name: row.name,
        cr_number: row.cr_number,
        vat_number: row.vat_number,
        address_line: row.address_line,
        city: row.city,
        district: null,
        postal_code: null,
        phone: row.contact_phone,
        email: null,
        state: row.state ?? null,
      };
    }
  }
  return getCompanySettings();
}
