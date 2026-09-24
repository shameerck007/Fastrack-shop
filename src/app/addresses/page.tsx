import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAddresses } from "@/lib/addresses";
import AddressForm from "@/components/AddressForm";
import AddressCard from "@/components/AddressCard";

export default async function AddressesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const addresses = await getAddresses();

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-4 text-xl font-semibold">Your Addresses</h1>

      <div className="mb-6 flex flex-col gap-3">
        {addresses.map((addr) => (
          <AddressCard key={addr.id} address={addr} />
        ))}
      </div>

      <h2 className="mb-2 text-sm font-medium text-neutral-500">Add a new address</h2>
      <AddressForm />
    </div>
  );
}
