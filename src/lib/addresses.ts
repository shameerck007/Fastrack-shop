import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant-server";
import type { Address } from "@/types/database";

export async function getAddresses(): Promise<Address[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false });

  if (error) throw error;
  // One account, several markets: show only the addresses that belong to the market being shopped.
  // Indian addresses always carry a state (the Saudi form has none), which tells them apart.
  const country = (await getCurrentTenant())?.country_code ?? "SA";
  return (data ?? []).filter((a) => (a.state ? "IN" : "SA") === country);
}
