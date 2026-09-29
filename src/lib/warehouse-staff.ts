import { createClient } from "@/lib/supabase/server";
import type { Order, OrderStatus, Warehouse } from "@/types/database";

export async function getMyStaffWarehouse(): Promise<Warehouse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff, error: staffError } = await supabase
    .from("warehouse_staff")
    .select("warehouse_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (staffError) throw staffError;
  if (!staff) return null;

  const { data: warehouse, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("id", staff.warehouse_id)
    .maybeSingle();
  if (error) throw error;
  return warehouse;
}

export interface WarehouseOrderItem {
  id: string;
  product_name: string;
  variant_label: string;
  ordered_quantity: number;
  line_total: number;
  product_variants: { products: { image_url: string | null; name: string; name_ar: string | null } | null } | null;
}

export interface WarehouseOrderRow
  extends Pick<Order, "id" | "order_number" | "status" | "created_at" | "total"> {
  order_items: WarehouseOrderItem[];
}

// RLS ("warehouse staff view their warehouse orders/order items", 0031)
// scopes this to exactly the signed-in staff account's own warehouse — no
// warehouse_id filter needed client-side, same shape as merchant orders.
export async function getWarehouseOrders(limit = 100): Promise<WarehouseOrderRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, created_at, total, order_items(id, product_name, variant_label, ordered_quantity, line_total, variant_id, product_variants!variant_id(products(image_url, name, name_ar)))"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  // RLS (0032) already excludes a staff member's own orders from their
  // warehouse queue — a staff account can also be a shopper at their own
  // location, and shouldn't see or process their own personal order. This
  // client-side filter is a second, explicit layer for the same rule.
  if (user) query = query.neq("user_id", user.id);

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as WarehouseOrderRow[]) ?? [];
}

export interface WarehouseOrderKPIs {
  newCount: number;
  preparingCount: number;
  readyCount: number;
}

export function summarizeWarehouseOrders(orders: WarehouseOrderRow[]): WarehouseOrderKPIs {
  return {
    newCount: orders.filter((o) => o.status === "pending" || o.status === "confirmed").length,
    preparingCount: orders.filter((o) => o.status === "preparing").length,
    readyCount: orders.filter((o) => o.status === "ready_for_pickup").length,
  };
}

export interface WarehouseStockRow {
  inventoryId: string;
  stock: number;
  minStock: number;
  productId: string;
  productName: string;
  productNameAr: string | null;
  imageUrl: string | null;
  variantLabel: string;
  variantLabelAr: string | null;
}

// Read side of the "stock only" boundary: joins inventory (scoped to this
// warehouse via the RLS-safe "inventory is publicly readable" select policy)
// to the shared FasTrack catalog purely for display — staff can UPDATE
// inventory.stock (0031) but there's no product/variant write path here.
export async function getWarehouseStock(warehouseId: string): Promise<WarehouseStockRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory")
    .select(
      "id, stock, min_stock, product_variants!variant_id(id, label, label_ar, products(id, name, name_ar, image_url, store_id))"
    )
    .eq("warehouse_id", warehouseId);
  if (error) throw error;

  type Row = {
    id: string;
    stock: number;
    min_stock: number;
    product_variants: {
      id: string;
      label: string;
      label_ar: string | null;
      products: { id: string; name: string; name_ar: string | null; image_url: string | null; store_id: string | null } | null;
    } | null;
  };

  return ((data as unknown as Row[]) ?? [])
    .filter((row) => row.product_variants?.products && row.product_variants.products.store_id === null)
    .map((row) => ({
      inventoryId: row.id,
      stock: row.stock,
      minStock: row.min_stock,
      productId: row.product_variants!.products!.id,
      productName: row.product_variants!.products!.name,
      productNameAr: row.product_variants!.products!.name_ar,
      imageUrl: row.product_variants!.products!.image_url,
      variantLabel: row.product_variants!.label,
      variantLabelAr: row.product_variants!.label_ar,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

export type { OrderStatus };
