import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAddresses } from "@/lib/addresses";
import AddressForm from "@/components/AddressForm";

export default async function AddressesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const addresses = await getAddresses();

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="mb-4 text-xl font-semibold">Your Addresses</h1>

      <div className="mb-4 flex flex-col gap-2">
        {addresses.map((addr) => (
          <div key={addr.id} className="rounded-xl border border-neutral-200 bg-white p-3 text-sm">
            <p className="font-medium capitalize">{addr.label}</p>
            <p className="text-neutral-600">{addr.address_line}</p>
          </div>
        ))}
      </div>

      <AddressForm />
    </div>
  );
}
