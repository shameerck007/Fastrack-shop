"use client";

import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useLocale } from "@/components/LocaleProvider";
import { EXPRESS_FEE, FREE_DELIVERY_THRESHOLD, STANDARD_FEE, formatDeliveryDate, standardDeliveryDate } from "@/lib/delivery-methods";
import { formatSAR } from "@/lib/utils";

function Row({ icon, title, detail, fee, ok }: { icon: string; title: string; detail: string; fee?: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3 ${ok ? "border-neutral-200 bg-white" : "border-neutral-200 bg-neutral-50 opacity-70"}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${ok ? "bg-blue-50" : "bg-neutral-100 grayscale"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-neutral-900">{title}</span>
        <span className={`block text-xs ${ok ? "text-neutral-600" : "text-neutral-500"}`}>{detail}</span>
      </span>
      {ok && fee && <span className="shrink-0 text-sm font-extrabold text-neutral-900">{fee}</span>}
    </div>
  );
}

interface Offer {
  express: boolean;
  standard: boolean;
  standardDays: number;
  expressRadiusKm: number | null;
}

function OptionRows({ offer }: { offer: Offer }) {
  const { t, locale } = useLocale();
  const freeHint = t("delivery_info.free_over", { amount: formatSAR(FREE_DELIVERY_THRESHOLD) });
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-extrabold tracking-tight text-neutral-900">{t("delivery_info.title")}</h3>
      <Row
        icon="⚡"
        title={t("delivery_info.express")}
        ok={offer.express}
        detail={
          offer.express
            ? `${t("delivery_info.express_eta")} · ${freeHint}`
            : offer.expressRadiusKm != null
              ? `${t("delivery_info.express_unavailable")} — ${t("delivery_info.express_within", { radius: offer.expressRadiusKm })}`
              : t("delivery_info.express_unavailable")
        }
        fee={formatSAR(EXPRESS_FEE)}
      />
      <Row
        icon="📦"
        title={t("delivery_info.standard")}
        ok={offer.standard}
        detail={
          offer.standard
            ? `${t("delivery_info.standard_by", { date: formatDeliveryDate(standardDeliveryDate(offer.standardDays), locale) })} · ${freeHint}`
            : t("delivery_info.standard_unavailable")
        }
        fee={formatSAR(STANDARD_FEE)}
      />
    </section>
  );
}

/** Which delivery methods apply to this seller at the shopper's location: Express (inside the
 * radius) and Standard (with an estimated date), each with its fee. */
export default function DeliveryOptionsInfo({ storeId }: { storeId: string | null }) {
  const { statusForStore, location } = useDeliveryLocation();
  const { t } = useLocale();
  const status = statusForStore(storeId);

  if (status.state === "loading") return null;
  if (status.state === "no_location" || !location) {
    return <p className="rounded-2xl bg-blue-50 px-3 py-2.5 text-xs font-medium text-blue-800">📍 {t("delivery_info.set_location")}</p>;
  }
  if (status.state === "outside") return null;
  return <OptionRows offer={status} />;
}

/** Same, for a whole cart: a method is offered only if every seller in the cart offers it. */
export function CartDeliveryOptions({ storeIds }: { storeIds: (string | null)[] }) {
  const { statusForStore, location } = useDeliveryLocation();
  const { t } = useLocale();
  const unique = [...new Set(storeIds)];
  const statuses = unique.map((id) => statusForStore(id));

  if (statuses.some((st) => st.state === "loading")) return null;
  if (!location || statuses.some((st) => st.state === "no_location")) {
    return <p className="rounded-2xl bg-blue-50 px-3 py-2.5 text-xs font-medium text-blue-800">📍 {t("delivery_info.set_location")}</p>;
  }
  const ok = statuses.filter((st): st is Extract<typeof st, { state: "ok" }> => st.state === "ok");
  if (ok.length === 0) return null;
  return (
    <OptionRows
      offer={{
        express: ok.length === statuses.length && ok.every((st) => st.express),
        standard: ok.length === statuses.length && ok.every((st) => st.standard),
        standardDays: Math.max(...ok.map((st) => st.standardDays)),
        expressRadiusKm: ok.find((st) => !st.express)?.expressRadiusKm ?? ok[0].expressRadiusKm,
      }}
    />
  );
}
