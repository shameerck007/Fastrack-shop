import { getAllStores } from "@/lib/merchant";
import StoreApprovalActions from "@/components/admin/StoreApprovalActions";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

export default async function AdminMerchantsPage() {
  const stores = await getAllStores();

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Merchants</h1>

      {stores.length === 0 ? (
        <p className="text-sm text-neutral-500">No merchant applications yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {stores.map((store) => (
            <div key={store.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <p className="font-medium">{store.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[store.status]}`}>
                      {store.status}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-500">CR: {store.cr_number}</p>
                  {store.vat_number && <p className="text-sm text-neutral-500">VAT: {store.vat_number}</p>}
                  {store.contact_phone && <p className="text-sm text-neutral-500">{store.contact_phone}</p>}
                  {store.address_line && <p className="text-sm text-neutral-500">{store.address_line}</p>}
                  {store.rejection_reason && (
                    <p className="mt-1 text-sm text-red-600">Rejected: {store.rejection_reason}</p>
                  )}
                </div>
                {store.status === "pending" && <StoreApprovalActions storeId={store.id} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
