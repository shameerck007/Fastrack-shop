"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push";

type Rpc = { rpc: (fn: string, args?: object) => Promise<{ data: unknown; error: { message: string; code?: string } | null }> };

function refresh() {
  revalidatePath("/admin/transfers");
  revalidatePath("/warehouse/transfers");
  revalidatePath("/warehouse/stock");
  revalidatePath("/warehouse");
}

function friendly(e: { message: string; code?: string }): string {
  if (e.code === "PGRST202" || e.code === "42883") return "Stock transfers need the latest database update (migration 0068). Run it, then try again.";
  return e.message;
}

async function staffOf(warehouseId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("warehouse_staff").select("user_id").eq("warehouse_id", warehouseId);
  return (data ?? []).map((s) => s.user_id as string);
}

/** Creates a transfer, and sends it straight away when asked (the stock leaves the sending location at once). */
export async function createStockTransfer(input: {
  fromId: string;
  toId: string;
  items: { variantId: string; quantity: number }[];
  note?: string;
  sendNow: boolean;
}): Promise<{ error?: string }> {
  const items = input.items.filter((i) => i.quantity > 0);
  if (items.length === 0) return { error: "Add at least one product with a quantity." };
  const supabase = (await createClient()) as unknown as Rpc;
  const { data, error } = await supabase.rpc("create_stock_transfer", {
    p_from: input.fromId,
    p_to: input.toId,
    p_items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    p_note: input.note ?? null,
  });
  if (error) return { error: friendly(error) };
  if (input.sendNow) {
    const sent = await sendStockTransfer(data as string);
    if (sent.error) return sent;
  }
  refresh();
  return {};
}

export async function sendStockTransfer(id: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as unknown as Rpc;
  const { error } = await supabase.rpc("send_stock_transfer", { p_id: id });
  if (error) return { error: friendly(error) };
  // Tell the receiving location it is on its way.
  const real = await createClient();
  const { data: t } = await (real as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { transfer_number: string; to_warehouse_id: string } | null }> } } } })
    .from("stock_transfers")
    .select("transfer_number, to_warehouse_id")
    .eq("id", id)
    .maybeSingle();
  if (t) await notifyUsers(await staffOf(t.to_warehouse_id), { title: "Stock on its way", body: `Transfer ${t.transfer_number} is coming to your location. Receive it when it arrives.`, url: "/warehouse/transfers" });
  refresh();
  return {};
}

export async function receiveStockTransfer(id: string, received?: Record<string, number>): Promise<{ error?: string }> {
  const supabase = (await createClient()) as unknown as Rpc;
  const { error } = await supabase.rpc("receive_stock_transfer", { p_id: id, p_received: received ?? null });
  if (error) return { error: friendly(error) };
  refresh();
  return {};
}

export async function cancelStockTransfer(id: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as unknown as Rpc;
  const { error } = await supabase.rpc("cancel_stock_transfer", { p_id: id });
  if (error) return { error: friendly(error) };
  refresh();
  return {};
}

/** A delivery from a supplier arrives: add it to a location's stock, with optional batch and expiry. */
export async function receiveStock(inventoryId: string, quantity: number, batch?: string, expiry?: string): Promise<{ error?: string }> {
  if (!(quantity > 0)) return { error: "Enter the quantity received." };
  const supabase = await createClient();
  const { data: row } = await supabase.from("inventory").select("stock").eq("id", inventoryId).maybeSingle();
  if (!row) return { error: "Could not find this stock line." };
  const { error } = await supabase
    .from("inventory")
    .update({ stock: Number(row.stock) + quantity, ...(batch?.trim() ? { batch_number: batch.trim() } : {}), ...(expiry ? { expiry_date: expiry } : {}), updated_at: new Date().toISOString() })
    .eq("id", inventoryId);
  if (error) return { error: error.message };
  refresh();
  return {};
}
