import { PageHeader } from "@/components/admin/AdminUi";
import BannersManager from "@/components/admin/BannersManager";
import { createClient } from "@/lib/supabase/server";
import type { BannerRow } from "@/lib/home-banners-utils";

export const metadata = { title: "Home banners" };

export default async function AdminBannersPage() {
  const supabase = await createClient();
  // The table is not in the generated types until migration 0108 is in.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("home_banners").select("*").order("sort_order").order("created_at");
  const notReady = !!error;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon="🖼️" title="Home banners" subtitle="The slider at the top of the shop home page: add, reorder, schedule and switch banners on or off." />
      {notReady && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Home banners aren&apos;t set up in the database yet. Run migration <b>0108_home_banners.sql</b> in the Supabase SQL editor, then reload this page.
        </p>
      )}
      <BannersManager banners={notReady ? [] : ((data ?? []) as BannerRow[])} disabled={notReady} />
    </div>
  );
}
