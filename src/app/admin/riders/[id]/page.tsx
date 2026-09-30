import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RiderStatusActions from "@/components/admin/RiderStatusActions";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default async function AdminRiderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const supabase = await createClient();

  const { data: rider } = await supabase.from("delivery_partners").select("*").eq("id", id).maybeSingle();
  if (!rider) notFound();

  const [{ data: profile }, { data: ownerEmail }, { count: deliveredCount }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", id).maybeSingle(),
    supabase.rpc("admin_get_user_email", { p_user_id: id }),
    supabase
      .from("delivery_assignments")
      .select("id, orders!inner(status)", { count: "exact", head: true })
      .eq("rider_id", id)
      .eq("orders.status", "delivered"),
  ]);

  const licenseUrl = rider.license_document_path
    ? (await supabase.storage.from("rider-documents").createSignedUrl(rider.license_document_path, 60 * 10)).data
        ?.signedUrl ?? null
    : null;

  return (
    <div>
      <Link href="/admin/riders" className="text-sm text-blue-600 hover:underline">
        {t("rider_detail.all_riders")}
      </Link>

      <div className="mb-4 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{profile?.full_name ?? "—"}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[rider.status]}`}>
              {t(`merchants_list.status_${rider.status}`)}
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            {t("rider_detail.joined", {
              date: new Date(rider.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US"),
            })}
          </p>
        </div>
        <RiderStatusActions riderId={rider.id} status={rider.status} />
      </div>

      {rider.rejection_reason && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <b>{t("rider_detail.rejection_reason")}</b> {rider.rejection_reason}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-2xl font-semibold">{deliveredCount ?? 0}</p>
          <p className="text-xs text-neutral-500">{t("rider_detail.deliveries_completed")}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-2xl font-semibold">{rider.rating ?? "—"}</p>
          <p className="text-xs text-neutral-500">{t("rider_detail.rating")}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("rider_detail.account")}>
          <Row label={t("rider_detail.name")}>{profile?.full_name ?? "—"}</Row>
          <Row label={t("rider_detail.email")}>{typeof ownerEmail === "string" ? ownerEmail : "—"}</Row>
          {profile?.phone && (
            <Row label={t("rider_detail.phone")}>
              <a href={`tel:${profile.phone}`} className="text-blue-600 hover:underline">
                {profile.phone}
              </a>
            </Row>
          )}
        </Card>

        <Card title={t("rider_detail.vehicle_details")}>
          <Row label={t("rider_detail.vehicle_type")}>{rider.vehicle_type ?? "—"}</Row>
          <Row label={t("rider_detail.license_number")}>{rider.license_number ?? "—"}</Row>
        </Card>

        <Card title={t("rider_detail.documents")}>
          {licenseUrl ? (
            <a href={licenseUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              {t("rider_detail.license_document")}
            </a>
          ) : (
            <span className="text-sm text-neutral-400">{t("rider_detail.no_license_document")}</span>
          )}
        </Card>
      </div>
    </div>
  );
}
