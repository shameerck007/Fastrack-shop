import TransferManager from "@/components/TransferManager";
import { PageHeader, StatGrid, StatTile } from "@/components/admin/AdminUi";
import { getFastrackLocations, getFastrackStock, getTransfers } from "@/lib/transfers";

export const metadata = { title: "Stock transfers" };

export default async function AdminTransfersPage() {
  const locations = await getFastrackLocations();
  const [transfers, stock] = await Promise.all([getTransfers(locations), getFastrackStock(locations.map((l) => l.id))]);
  const nameOf = new Map(locations.map((l) => [l.id, l.name]));

  if (transfers === null) {
    return (
      <div>
        <PageHeader icon="🔁" title="Stock transfers" subtitle="Move stock between FasTrack locations and see what is running low." />
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Stock transfers aren&apos;t set up in the database yet. Run migration <b>0068_stock_transfers_and_low_stock.sql</b> in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  const inTransit = transfers.filter((t) => t.status === "in_transit").length;
  const draft = transfers.filter((t) => t.status === "draft").length;

  return (
    <div>
      <PageHeader icon="🔁" title="Stock transfers" subtitle="Move stock between FasTrack's own locations. Stock leaves the sending location when sent and arrives when received. Items below their minimum are listed first." />
      <StatGrid>
        <StatTile icon="🏬" label="FasTrack locations" value={locations.length} accent="#2563eb" />
        <StatTile icon="🚚" label="On their way" value={inTransit} accent="#0369a1" />
        <StatTile icon="📝" label="Drafts" value={draft} accent="#1e40af" />
        <StatTile icon="⚠️" label="Running low" value={stock.low.length} accent="#0ea5e9" hint="Below minimum stock" />
      </StatGrid>
      <TransferManager
        locations={locations}
        transfers={transfers}
        stock={stock.options}
        low={stock.low.map((l) => ({ ...l, warehouseName: nameOf.get(l.warehouseId) ?? "Location" }))}
      />
    </div>
  );
}
