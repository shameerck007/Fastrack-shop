"use server";

import { getCompanySettings } from "@/lib/company-settings";
import type { PackItem } from "@/lib/scan";

import { UserError, failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyOrderStatusChange, notifyNearbyRidersOfNewOrder } from "@/lib/push";
import { dispatchExpressOrder } from "@/lib/dispatch";
import { sendOrderStatusEmail } from "@/lib/email-notifications";
import type { OrderStatus } from "@/types/database";

// Same shape as advanceMerchantOrderStatus — the "warehouse staff advance
// their orders" RLS policy (0031) is the real boundary (only this staff
// account's warehouse, only pending/confirmed/preparing -> next stage);
// this allowlist is just a clear-error UX guard.
const ALLOWED_NEXT: Record<string, OrderStatus> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready_for_pickup",
};

export async function advanceWarehouseOrderStatus(orderId: string, currentStatus: OrderStatus, packed = false) {
  try {
  const supabase = await createClient();
  if (currentStatus === "preparing" && !packed && (await getCompanySettings()).require_pack_scan) {
    throw new UserError("Scan or tick every item first: open \"Pack & scan\" on this order.");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");

  const next = ALLOWED_NEXT[currentStatus];
  if (!next) throw new UserError("This order can't be advanced from its current status.");

  const { data, error } = await supabase
    .from("orders")
    .update({ status: next })
    .eq("id", orderId)
    .eq("status", currentStatus)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new UserError("This order already moved on — refresh and try again.");
  }

  await supabase.from("order_status_history").insert({ order_id: orderId, status: next });
  await notifyOrderStatusChange(orderId, next);
  await sendOrderStatusEmail(orderId, next);
  if (next === "ready_for_pickup") await notifyNearbyRidersOfNewOrder(orderId);
  // Express: start offering to riders as soon as packing begins, so one is close by when it is ready.
  else if (next === "preparing") await dispatchExpressOrder(orderId);

  revalidatePath("/warehouse/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/admin/orders");

  } catch (e) {
    return failure(e) as never;
  }
}

export async function updateWarehouseStock(inventoryId: string, stock: number) {
  try {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory").update({ stock }).eq("id", inventoryId);
  if (error) throw error;
  revalidatePath("/warehouse/stock");

  } catch (e) {
    return failure(e) as never;
  }
}

/** The items of an order to pack, with every code that identifies each one (product barcode, catalogue pack barcode, SKU). */
export async function getPackList(orderId: string): Promise<PackItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("order_items")
      .select("id, product_name, variant_label, ordered_quantity, product_variants!variant_id(master_variant_id, products(barcode, sku))")
      .eq("order_id", orderId);
    if (error) throw error;
    const rows = (data ?? []) as unknown as { id: string; product_name: string; variant_label: string | null; ordered_quantity: number; product_variants: { master_variant_id: string | null; products: { barcode: string | null; sku: string | null } | null } | null }[];
    const masterIds = rows.map((r) => r.product_variants?.master_variant_id).filter((x): x is string => !!x);
    const masterCodes = new Map<string, string>();
    if (masterIds.length) {
      const { data: mv } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { in: (c: string, v: string[]) => Promise<{ data: { id: string; barcode: string | null }[] | null }> } } }).from("master_variants").select("id, barcode").in("id", masterIds);
      for (const m of mv ?? []) if (m.barcode) masterCodes.set(m.id, m.barcode);
    }
    return rows.map((r) => ({
      id: r.id,
      name: r.variant_label ? `${r.product_name} (${r.variant_label})` : r.product_name,
      quantity: Number(r.ordered_quantity),
      codes: [r.product_variants?.products?.barcode, r.product_variants?.products?.sku, r.product_variants?.master_variant_id ? masterCodes.get(r.product_variants.master_variant_id) : null].filter((c): c is string => !!c),
    }));
  } catch (e) {
    return failure(e) as never;
  }
}
