"use server";



import { friendlyMessage } from "@/lib/errors";
import { failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result<T = object> = ({ error?: undefined } & T) | { error: string };

/** The full phone and email of a customer. Only the platform super admin can do this, and every reveal is recorded. */
export async function revealCustomerContact(id: string): Promise<Result<{ phone: string | null; email: string | null }>> {
  try {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reveal_customer_contact" as never, { p_id: id } as never);
  if (error) return await { error: friendlyMessage(error) };
  const d = data as unknown as { phone: string | null; email: string | null };
  return await { phone: d.phone, email: d.email };

  } catch (e) {
    return failure(e) as never;
  }
}

/** A blocked customer cannot place orders (they can still browse and sign in). */
export async function setCustomerBlocked(id: string, blocked: boolean, reason?: string): Promise<{ error?: string }> {
  try {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_customer_blocked" as never, { p_id: id, p_blocked: blocked, p_reason: reason ?? null } as never);
  if (error) return await { error: friendlyMessage(error) };
  revalidatePath("/admin/users");
  return await {};

  } catch (e) {
    return failure(e) as never;
  }
}

export async function addCustomerNote(id: string, body: string): Promise<{ error?: string }> {
  try {
  const text = body.trim();
  if (!text) return await { error: "Write a note first." };
  if (text.length > 2000) return await { error: "Keep the note under 2,000 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_customer_note" as never, { p_id: id, p_body: text } as never);
  if (error) return await { error: friendlyMessage(error) };
  revalidatePath("/admin/users");
  return await {};

  } catch (e) {
    return failure(e) as never;
  }
}
