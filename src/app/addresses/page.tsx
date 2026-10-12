import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAddresses } from "@/lib/addresses";
import AddressForm from "@/components/AddressForm";
import AddressCard from "@/components/AddressCard";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function AddressesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);
  const addresses = await getAddresses();
  // The default address first, then the rest in the order they were saved.
  const sorted = [...addresses].sort((a, b) => Number(b.is_default) - Number(a.is_default));

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-6 md:py-10">
      <div className="mb-4 max-md:hidden">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">{t("addresses.title")}</h1>
        <p className="text-sm text-neutral-500">Where should we deliver? Save the places you order to most.</p>
      </div>

      <div className="mb-4">
        <AddressForm variant="tile" />
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-5xl">📍</span>
          <p className="text-sm font-semibold text-neutral-800">{t("addresses.no_addresses_yet")}</p>
          <p className="text-xs text-neutral-500">Add your first address to get your order delivered to your door.</p>
        </div>
      ) : (
        <>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-neutral-400">
            {sorted.length} saved {sorted.length === 1 ? "address" : "addresses"}
          </p>
          <div className="flex flex-col gap-3">
            {sorted.map((addr) => (
              <AddressCard key={addr.id} address={addr} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
