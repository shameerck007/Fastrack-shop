"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant-server";
import type { OfferKind } from "@/lib/offers";

const MISSING = "Offers and delivery fees need database migrations 0081 and 0082. Run them in the Supabase SQL editor, then try again.";
const missing = (code?: string) => code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205";

export interface DeliveryFeesInput {
  /** Empty (null) keeps the market's built-in default. */
  express: number | null;
  standard: number | null;
  freeOver: number | null;
  freeEnabled: boolean;
}

/** The delivery fees shoppers pay, and the order value above which delivery is free. */
export async function saveDeliveryFees(input: DeliveryFeesInput): Promise<{ error?: string }> {
  for (const v of [input.express, input.standard, input.freeOver]) {
    if (v !== null && !(Number.isFinite(v) && v >= 0 && v <= 100000)) return { error: "Enter amounts of zero or more." };
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return { error: "No market selected." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_settings")
    .update({ delivery_fee_express: input.express, delivery_fee_standard: input.standard, free_delivery_over: input.freeOver, free_delivery_enabled: input.freeEnabled } as never)
    .eq("tenant_id", tenant.id);
  if (error) return { error: missing(error.code) ? MISSING : error.message };
  for (const p of ["/admin/delivery-fees", "/cart", "/checkout", "/"]) revalidatePath(p);
  return {};
}

export interface OfferInput {
  id?: string;
  name: string;
  nameAr?: string;
  kind: OfferKind;
  /** A code the shopper types; empty with `auto` on means the offer applies by itself. */
  code?: string;
  auto: boolean;
  value: number | null;
  maxDiscount: number | null;
  minOrder: number | null;
  categoryId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  firstOrderOnly: boolean;
  isActive: boolean;
  /** Who pays for the discount: FasTrack, or the supplier named in `storeId` (taken off that supplier's settlement). */
  fundedBy: "fastrack" | "supplier";
  /** Limits the offer to one supplier's products. Required when the supplier pays. */
  storeId: string | null;
  /** One more automatic offer may apply together with this one. */
  stackable: boolean;
}

export async function saveOffer(input: OfferInput): Promise<{ error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Give the offer a name." };
  const code = input.auto ? null : (input.code ?? "").trim().toUpperCase();
  if (!input.auto && !/^[A-Z0-9_-]{3,24}$/.test(code ?? "")) return { error: "The code needs 3 to 24 letters, numbers, - or _." };
  const value = input.kind === "free_delivery" ? 0 : Number(input.value);
  if (input.kind !== "free_delivery" && !(value > 0)) return { error: input.kind === "percent" ? "Enter the percentage off." : "Enter the amount off." };
  if (input.kind === "percent" && value > 100) return { error: "A percentage cannot be more than 100." };
  for (const v of [input.maxDiscount, input.minOrder]) if (v !== null && !(v >= 0)) return { error: "Amounts cannot be negative." };
  for (const v of [input.usageLimit, input.perCustomerLimit]) if (v !== null && !(Number.isInteger(v) && v > 0)) return { error: "Limits must be whole numbers above zero." };
  const supplierPays = input.fundedBy === "supplier" && input.kind !== "free_delivery";
  if (supplierPays && !input.storeId) return { error: "Choose the supplier who pays for this offer." };
  if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) return { error: "The end is before the start." };

  const row = {
    name,
    name_ar: input.nameAr?.trim() || null,
    code,
    auto_apply: input.auto,
    kind: input.kind,
    value,
    max_discount: input.kind === "percent" ? input.maxDiscount : null,
    min_order: input.minOrder,
    category_id: input.kind === "free_delivery" ? null : input.categoryId || null,
    starts_at: input.startsAt ? new Date(input.startsAt).toISOString() : null,
    ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
    usage_limit: input.usageLimit,
    per_customer_limit: input.perCustomerLimit,
    first_order_only: input.firstOrderOnly,
    is_active: input.isActive,
    funded_by: supplierPays ? "supplier" : "fastrack",
    store_id: input.kind === "free_delivery" ? null : input.storeId || null,
    stackable: input.stackable,
  };
  // The offers tables are not in the generated types until the migration is in.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;
  const { error } = input.id ? await db.from("offers").update(row).eq("id", input.id) : await db.from("offers").insert(row);
  if (error) {
    if (error.code === "23505") return { error: "That code is already used by another offer." };
    return { error: missing(error.code) ? MISSING : error.message };
  }
  revalidatePath("/admin/offers");
  return {};
}

export async function setOfferActive(id: string, active: boolean): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;
  const { error } = await db.from("offers").update({ is_active: active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/offers");
  return {};
}

export async function deleteOffer(id: string): Promise<{ error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;
  const { error } = await db.from("offers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/offers");
  return {};
}

/** The maximum order quantity a new product starts with in this market (each product can then be changed). */
export async function saveDefaultMaxOrderQty(qty: number): Promise<{ error?: string }> {
  if (!(Number.isInteger(qty) && qty >= 1 && qty <= 10000)) return { error: "Enter a whole number of 1 or more." };
  const tenant = await getCurrentTenant();
  if (!tenant) return { error: "No market selected." };
  const supabase = await createClient();
  const { error } = await supabase.from("company_settings").update({ default_max_order_qty: qty } as never).eq("tenant_id", tenant.id);
  if (error) return { error: missing(error.code) ? "Run database migration 0087 first." : error.message };
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return {};
}
