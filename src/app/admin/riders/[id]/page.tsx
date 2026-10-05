import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkSaudiIban, formatIban } from "@/lib/iban";
import { checkBankDetails } from "@/lib/saudi-banks";
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

  async function signed(path: string | null | undefined) {
    if (!path) return null;
    return (await supabase.storage.from("rider-documents").createSignedUrl(path, 60 * 10)).data?.signedUrl ?? null;
  }
  const [licenseUrl, idFrontUrl, idBackUrl, selfieUrl, registrationUrl, insuranceUrl] = await Promise.all([
    signed(rider.license_document_path),
    signed(rider.id_front_path),
    signed(rider.id_back_path),
    signed(rider.selfie_path),
    signed(rider.registration_path),
    signed(rider.insurance_path),
  ]);
  const docs: [string, string | null][] = [
    [t("rider_detail.license_document"), licenseUrl],
    ["ID — front", idFrontUrl],
    ["ID — back", idBackUrl],
    ["Selfie", selfieUrl],
    ["Vehicle registration (Istimara)", registrationUrl],
    ["Insurance", insuranceUrl],
  ];
  const today = new Date().toISOString().slice(0, 10);
  const expiry = (d: string | null) =>
    d ? <span className={d < today ? "font-medium text-red-600" : ""}>{d}{d < today ? " (expired)" : ""}</span> : "—";
  const ibanOk = rider.bank_iban ? checkSaudiIban(rider.bank_iban).ok && checkBankDetails(rider.bank_name ?? "", rider.bank_iban).ok : false;

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
          <Row label="Licence expiry">{expiry(rider.license_expiry)}</Row>
          {rider.vehicle_plate && <Row label="Plate">{rider.vehicle_plate}</Row>}
          {rider.vehicle_make_model && <Row label="Make & model">{rider.vehicle_make_model}{rider.vehicle_year ? ` (${rider.vehicle_year})` : ""}</Row>}
          {rider.registration_path && <Row label="Registration expiry">{expiry(rider.registration_expiry)}</Row>}
        </Card>

        <Card title="Identity">
          <Row label="ID type">{rider.id_type === "iqama" ? "Iqama" : rider.id_type === "national_id" ? "National ID" : "—"}</Row>
          <Row label="ID number"><span className="font-mono">{rider.id_number ?? "—"}</span></Row>
          <Row label="Nationality">{rider.nationality ?? "—"}</Row>
          <Row label="Date of birth">{rider.date_of_birth ?? "—"}</Row>
          <Row label="City">{rider.city ?? "—"}</Row>
          <Row label="Emergency contact">
            {rider.emergency_contact_name ? `${rider.emergency_contact_name} · ${rider.emergency_contact_phone ?? ""}` : "—"}
          </Row>
        </Card>

        <Card title="Payout">
          <Row label="Method">{rider.payout_method === "bank" ? "Bank transfer" : "Cash"}</Row>
          {rider.payout_method === "bank" && (
            <>
              <Row label="Bank">{rider.bank_name ?? "—"}</Row>
              <Row label="Account holder">{rider.bank_account_holder ?? "—"}</Row>
              {rider.bank_iban && (
                <Row label="IBAN">
                  <span className="font-mono">{formatIban(rider.bank_iban)}</span>{" "}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ibanOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {ibanOk ? "Valid" : "Check IBAN"}
                  </span>
                </Row>
              )}
            </>
          )}
          <Link href={`/admin/rider-settlements/${rider.id}`} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            View settlement →
          </Link>
        </Card>

        <Card title={t("rider_detail.documents")}>
          <ul className="flex flex-col gap-1.5">
            {docs.map(([label, url]) => (
              <li key={label} className="flex justify-between gap-3 text-sm">
                <span className="text-neutral-500">{label}</span>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    View
                  </a>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
