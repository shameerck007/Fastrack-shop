import { createClient } from "@/lib/supabase/server";

// Stock transfers between FasTrack's own locations (migration 0068).

export interface TransferItem {
  id: string;
  variantId: string;
  name: string;
  label: string;
  quantity: number;
  receivedQuantity: number | null;
}

export interface Transfer {
  id: string;
  number: string;
  status: "draft" | "in_transit" | "received" | "cancelled";
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  note: string | null;
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
  items: TransferItem[];
}

export interface Location {
  id: string;
  name: string;
}

export interface StockOption {
  warehouseId: string;
  variantId: string;
  name: string;
  label: string;
  stock: number;
}

export interface LowStockRow {
  warehouseId: string;
  warehouseName: string;
  variantId: string;
  name: string;
  label: string;
  stock: number;
  minStock: number;
}

/** FasTrack's own locations: active warehouses no supplier owns. */
export async function getFastrackLocations(): Promise<Location[]> {
  const supabase = await createClient();
  const [{ data: whs }, { data: stores }] = await Promise.all([
    supabase.from("warehouses").select("id, name").eq("is_active", true).order("created_at"),
    supabase.from("stores").select("warehouse_id"),
  ]);
  const supplier = new Set((stores ?? []).map((s) => s.warehouse_id).filter(Boolean));
  return (whs ?? []).filter((w) => !supplier.has(w.id)).map((w) => ({ id: w.id, name: w.name }));
}

type TransferRow = {
  id: string;
  transfer_number: string;
  status: Transfer["status"];
  from_warehouse_id: string;
  to_warehouse_id: string;
  note: string | null;
  created_at: string;
  sent_at: string | null;
  received_at: string | null;
  stock_transfer_items: { id: string; variant_id: string; quantity: number; received_quantity: number | null; product_variants: { label: string; products: { name: string } | null } | null }[];
};

/** Transfers this user can see (admins: all; location staff: those to or from their location). Null before the migration. */
export async function getTransfers(locations: Location[]): Promise<Transfer[] | null> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => { select: (c: string) => { order: (c: string, o: object) => { limit: (n: number) => Promise<{ data: unknown; error: unknown }> } } };
  })
    .from("stock_transfers")
    .select("id, transfer_number, status, from_warehouse_id, to_warehouse_id, note, created_at, sent_at, received_at, stock_transfer_items(id, variant_id, quantity, received_quantity, product_variants(label, products(name)))")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return null;
  const nameOf = new Map(locations.map((l) => [l.id, l.name]));
  return ((data ?? []) as unknown as TransferRow[]).map((t) => ({
    id: t.id,
    number: t.transfer_number,
    status: t.status,
    fromId: t.from_warehouse_id,
    fromName: nameOf.get(t.from_warehouse_id) ?? "Location",
    toId: t.to_warehouse_id,
    toName: nameOf.get(t.to_warehouse_id) ?? "Location",
    note: t.note,
    createdAt: t.created_at,
    sentAt: t.sent_at,
    receivedAt: t.received_at,
    items: (t.stock_transfer_items ?? []).map((i) => ({
      id: i.id,
      variantId: i.variant_id,
      name: i.product_variants?.products?.name ?? "Product",
      label: i.product_variants?.label ?? "",
      quantity: Number(i.quantity),
      receivedQuantity: i.received_quantity == null ? null : Number(i.received_quantity),
    })),
  }));
}

type InvRow = {
  warehouse_id: string;
  stock: number;
  min_stock: number;
  variant_id: string;
  product_variants: { label: string; products: { name: string; store_id: string | null } | null } | null;
};

/** Stock lines at FasTrack locations (the ones the user may read), for picking transfer items and showing low stock. */
export async function getFastrackStock(locationIds: string[]): Promise<{ options: StockOption[]; low: Omit<LowStockRow, "warehouseName">[] }> {
  if (locationIds.length === 0) return { options: [], low: [] };
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory")
    .select("warehouse_id, stock, min_stock, variant_id, product_variants!variant_id(label, products(name, store_id))")
    .in("warehouse_id", locationIds);
  const rows = ((data ?? []) as unknown as InvRow[]).filter((r) => r.product_variants?.products && r.product_variants.products.store_id == null);
  return {
    options: rows.map((r) => ({
      warehouseId: r.warehouse_id,
      variantId: r.variant_id,
      name: r.product_variants!.products!.name,
      label: r.product_variants!.label,
      stock: Number(r.stock),
    })),
    low: rows
      .filter((r) => Number(r.min_stock) > 0 && Number(r.stock) < Number(r.min_stock))
      .map((r) => ({
        warehouseId: r.warehouse_id,
        variantId: r.variant_id,
        name: r.product_variants!.products!.name,
        label: r.product_variants!.label,
        stock: Number(r.stock),
        minStock: Number(r.min_stock),
      })),
  };
}
