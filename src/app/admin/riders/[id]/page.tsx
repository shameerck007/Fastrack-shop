import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkSaudiIban, formatIban } from "@/lib/iban";
import { checkBankDetails } from "@/lib/saudi-banks";
import { needsVehicleDocs } from "@/lib/rider-validation";
import RiderStatusActions from "@/components/admin/RiderStatusActions";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

function Card({ title, icon, children, action }: { title: string; icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-sm">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      <dl className="divide-y divide-neutral-100">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "" || children === false;
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className={`min-w-0 break-words text-right ${empty ? "text-neutral-300" : "font-medium text-neutral-900"}`}>
        {empty ? "Not provided" : children}
      </dd>
    </div>
  );
}

function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
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

  const bicycle = !needsVehicleDocs(rider.vehicle_type ?? "");
  const docDefs: { label: string; path: string | null; required: boolean }[] = [
    { label: "Selfie", path: rider.selfie_path, required: true },
    { label: "ID — front", path: rider.id_front_path, required: true },
    { label: "ID — back", path: rider.id_back_path, required: true },
    { label: t("rider_detail.license_document"), path: rider.license_document_path, required: true },
    { label: "Vehicle registration (Istimara)", path: rider.registration_path, required: !bicycle },
    { label: "Insurance", path: rider.insurance_path, required: false },
  ];
  const urls = await Promise.all(docDefs.map((d) => signed(d.path)));
  const docs = docDefs.map((d, i) => ({ ...d, url: urls[i] }));
  const selfieUrl = docs[0].url;
  const requiredDocs = docs.filter((d) => d.required);
  const docsDone = requiredDocs.filter((d) => d.path).length;

  const today = new Date().toISOString().slice(0, 10);
  const expiry = (d: string | null) =>
    d ? (
      <span className={d < today ? "text-red-600" : ""}>
        {d}
        {d < today ? " · expired" : ""}
      </span>
    ) : null;
  const age = ageFrom(rider.date_of_birth);
  const name = profile?.full_name ?? "—";
  const legacy = !rider.id_number && !rider.selfie_path;
  const ibanOk = rider.bank_iban ? checkSaudiIban(rider.bank_iban).ok && checkBankDetails(rider.bank_name ?? "", rider.bank_iban).ok : false;
  const idLabel = rider.id_type ? ({ iqama: "Iqama", national_id: "National ID", aadhaar: "Aadhaar", pan: "PAN" } as Record<string, string>)[rider.id_type] ?? null : null;
  const isImage = (p: string | null) => !!p && /\.(jpe?g|png|webp|gif|heic)$/i.test(p);

  return (
    <div>
      <Link href="/admin/riders" className="text-sm text-blue-600 hover:underline">
        {t("rider_detail.all_riders")}
      </Link>

      {/* header */}
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          {selfieUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selfieUrl} alt={name} className="h-16 w-16 rounded-full object-cover ring-2 ring-blue-100" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-2xl font-semibold text-blue-700">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[rider.status]}`}>
                {t(`merchants_list.status_${rider.status}`)}
              </span>
            </div>
            <p className="text-sm text-neutral-500">
              {[rider.city, rider.vehicle_type, rider.payout_method === "bank" ? "Bank payout" : "Cash payout"].filter(Boolean).join(" · ")}
            </p>
            <p className="text-xs text-neutral-400">
              {t("rider_detail.joined", {
                date: new Date(rider.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US"),
              })}
            </p>
          </div>
        </div>
        <RiderStatusActions riderId={rider.id} status={rider.status} />
      </div>

      {rider.rejection_reason && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <b>{t("rider_detail.rejection_reason")}</b> {rider.rejection_reason}
        </div>
      )}

      {legacy && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This application was submitted with the earlier, shorter form, so ID, selfie, vehicle and payout details were never collected. Review the licence
          below; new applications use the full form.
        </div>
      )}

      {/* key numbers */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("rider_detail.deliveries_completed"), value: String(deliveredCount ?? 0) },
          { label: t("rider_detail.rating"), value: rider.rating ? String(rider.rating) : "—" },
          { label: "Documents", value: `${docsDone}/${requiredDocs.length}`, tone: docsDone === requiredDocs.length ? "text-emerald-600" : "text-amber-600" },
          {
            label: "Licence",
            value: rider.license_expiry ? (rider.license_expiry < today ? "Expired" : "Valid") : "No expiry on file",
            tone: rider.license_expiry ? (rider.license_expiry < today ? "text-red-600" : "text-emerald-600") : "text-neutral-400",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
            <p className={`text-xl font-semibold ${k.tone ?? ""}`}>{k.value}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Personal & contact" icon="👤">
          <Row label={t("rider_detail.name")}>{profile?.full_name}</Row>
          <Row label={t("rider_detail.email")}>{typeof ownerEmail === "string" ? ownerEmail : null}</Row>
          <Row label={t("rider_detail.phone")}>
            {profile?.phone ? (
              <a href={`tel:${profile.phone}`} className="text-blue-600 hover:underline">
                {profile.phone}
              </a>
            ) : null}
          </Row>
          <Row label="Date of birth">{rider.date_of_birth ? `${rider.date_of_birth}${age !== null ? ` (${age} yrs)` : ""}` : null}</Row>
          <Row label="Nationality">{rider.nationality}</Row>
          <Row label="City">{rider.city}</Row>
          <Row label="Emergency contact">
            {rider.emergency_contact_name ? (
              <>
                {rider.emergency_contact_name}
                {rider.emergency_contact_phone && (
                  <>
                    {" · "}
                    <a href={`tel:${rider.emergency_contact_phone}`} className="text-blue-600 hover:underline">
                      {rider.emergency_contact_phone}
                    </a>
                  </>
                )}
              </>
            ) : null}
          </Row>
        </Card>

        <Card title="Identity" icon="🪪">
          <Row label="ID type">{idLabel}</Row>
          <Row label="ID number">{rider.id_number ? <span className="font-mono">{rider.id_number}</span> : null}</Row>
          <Row label="Terms accepted">
            {rider.terms_accepted_at ? new Date(rider.terms_accepted_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US") : null}
          </Row>
        </Card>

        <Card title={t("rider_detail.vehicle_details")} icon="🛵">
          <Row label={t("rider_detail.vehicle_type")}>{rider.vehicle_type}</Row>
          <Row label={t("rider_detail.license_number")}>{rider.license_number}</Row>
          <Row label="Licence expiry">{expiry(rider.license_expiry)}</Row>
          {!bicycle && (
            <>
              <Row label="Plate number">{rider.vehicle_plate}</Row>
              <Row label="Make & model">
                {rider.vehicle_make_model ? `${rider.vehicle_make_model}${rider.vehicle_year ? ` (${rider.vehicle_year})` : ""}` : null}
              </Row>
              <Row label="Registration expiry">{expiry(rider.registration_expiry)}</Row>
            </>
          )}
        </Card>

        <Card
          title="Payout"
          icon="💳"
          action={
            <Link href={`/admin/rider-settlements/${rider.id}`} className="text-xs font-medium text-blue-600 hover:underline">
              View settlement →
            </Link>
          }
        >
          <Row label="Method">{rider.payout_method === "bank" ? "Bank transfer" : "Cash"}</Row>
          {rider.payout_method === "bank" && (
            <>
              <Row label="Bank">{rider.bank_name}</Row>
              <Row label="Account holder">{rider.bank_account_holder}</Row>
              {rider.bank_account_number && (
                <Row label="Account number">
                  <span className="font-mono">{rider.bank_account_number}</span>
                </Row>
              )}
              {rider.bank_ifsc && (
                <Row label="IFSC">
                  <span className="font-mono">{rider.bank_ifsc}</span>
                </Row>
              )}
              <Row label="IBAN">
                {rider.bank_iban ? (
                  <>
                    <span className="font-mono">{formatIban(rider.bank_iban)}</span>{" "}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ibanOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {ibanOk ? "Valid" : "Check IBAN"}
                    </span>
                  </>
                ) : null}
              </Row>
            </>
          )}
        </Card>
      </div>

      <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-sm">📎</span>
          {t("rider_detail.documents")}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {docs.map((d) => (
            <div key={d.label} className="flex flex-col">
              {d.url ? (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block aspect-[4/3] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
                >
                  {isImage(d.path) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.url} alt={d.label} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-neutral-500">
                      <span className="text-2xl">📄</span>
                      <span className="text-xs text-blue-600">Open PDF</span>
                    </span>
                  )}
                </a>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-400">
                  {d.required ? "Missing" : "Not provided"}
                </div>
              )}
              <p className="mt-1.5 text-xs font-medium text-neutral-700">{d.label}</p>
              {!d.required && !d.path && <p className="text-[10px] text-neutral-400">Optional</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
