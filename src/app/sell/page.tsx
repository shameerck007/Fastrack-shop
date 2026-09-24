import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyStore } from "@/lib/merchant";
import StoreApplicationForm from "@/components/merchant/StoreApplicationForm";

export default async function SellPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/sell");

  const store = await getMyStore();

  if (store?.status === "approved") redirect("/merchant");

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Sell on FasTrack Shop</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Reach customers across Riyadh with same-day delivery, handled by FasTrack.
      </p>

      {!store && <StoreApplicationForm />}

      {store?.status === "pending" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-medium text-amber-800">Application under review</p>
          <p className="mt-1 text-sm text-amber-700">
            Thanks for applying, {store.name}. Our team is reviewing your details and will notify you
            once it&apos;s approved.
          </p>
        </div>
      )}

      {store?.status === "rejected" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">Application not approved</p>
          {store.rejection_reason && (
            <p className="mt-1 text-sm text-red-700">{store.rejection_reason}</p>
          )}
          <p className="mt-2 text-sm text-neutral-600">
            Questions? <Link href="/account" className="text-blue-700 hover:underline">Contact support</Link>.
          </p>
        </div>
      )}

      {store?.status === "suspended" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">Store suspended</p>
          <p className="mt-1 text-sm text-neutral-600">
            Your store has been suspended. Contact support for details.
          </p>
        </div>
      )}
    </div>
  );
}
