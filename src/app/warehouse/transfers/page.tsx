import { redirect } from "next/navigation";
import TransferManager from "@/components/TransferManager";
import { getMyStaffWarehouse } from "@/lib/warehouse-staff";
import { getFastrackLocations, getFastrackStock, getTransfers } from "@/lib/transfers";

export const metadata = { title: "Stock transfers" };

export default async function WarehouseTransfersPage() {
  const warehouse = await getMyStaffWarehouse();
  if (!warehouse) redirect("/");
  const locations = await getFastrackLocations();
  const [transfers, stock] = await Promise.all([getTransfers(locations), getFastrackStock([warehouse.id])]);
  const nameOf = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div>
      <h1 className="text-xl font-semibold">Stock transfers</h1>
      <p className="mb-5 mt-1 text-sm text-neutral-500">Send stock from {warehouse.name} to another FasTrack location, and receive stock that is sent to you.</p>
      {transfers === null ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">Stock transfers aren&apos;t available yet. Ask your admin to finish the setup.</p>
      ) : (
        <TransferManager
          locations={locations}
          transfers={transfers}
          stock={stock.options}
          low={stock.low.map((l) => ({ ...l, warehouseName: nameOf.get(l.warehouseId) ?? "Location" }))}
          myLocationId={warehouse.id}
        />
      )}
    </div>
  );
}
