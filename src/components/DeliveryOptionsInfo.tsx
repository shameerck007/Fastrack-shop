"use client";

import { useDeliveryLocation } from "@/components/delivery-location-context";
import { useMarket } from "@/components/MoneyProvider";
import { marketOffsetMinutes } from "@/lib/timezone";
import { useLocale } from "@/components/LocaleProvider";
import { formatDeliveryDate, pricingFor, standardDeliveryDate } from "@/lib/delivery-methods";
import { useMoney } from "@/components/MoneyProvider";
import { formatEta } from "@/lib/eta";
import { marketUi } from "@/lib/market-ui";
import { useAllStores } from "@/components/StoreDirectoryProvider";


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
  /** Express time worked out for this location (e.g. "20–25 min"); the fixed wording is used when absent. */
  etaText?: string | null;
}

function OptionRows({ offer }: { offer: Offer }) {
  const etaText = offer.etaText ?? null;
  const money = useMoney();
  const { t, locale } = useLocale();
  const offsetMin = marketOffsetMinutes(useMarket().countryCode);
  const pricing = pricingFor(useMarket().countryCode);
  const freeHint = t("delivery_info.free_over", { amount: money(pricing.freeOver) });
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-extrabold tracking-tight text-neutral-900">{t("delivery_info.title")}</h3>
      {/* The system picks the method for this address, like other quick-commerce apps: one line, not a menu. */}
      {offer.express ? (
        <Row icon="🛵" title={t("delivery_info.express")} ok detail={`${etaText ?? t("delivery_info.express_eta")} · ${freeHint}`} fee={money(pricing.express)} />
      ) : offer.standard ? (
        <Row
          icon="📦"
          title={t("delivery_info.standard")}
          ok
          detail={`${t("delivery_info.standard_by", { date: formatDeliveryDate(standardDeliveryDate(offer.standardDays, new Date(), offsetMin), locale) })} · ${freeHint}`}
          fee={money(pricing.standard)}
        />
      ) : (
        <Row icon="📦" title={t("delivery_info.title")} ok={false} detail={t("delivery_info.standard_unavailable")} />
      )}
    </section>
  );
}

/** Which delivery methods apply to this seller at the shopper's location: Express (inside the
 * radius) and Standard (with an estimated date), each with its fee. */
export default function DeliveryOptionsInfo({ storeId }: { storeId: string | null }) {
  const { statusForStore, location, etaForStore } = useDeliveryLocation();
  const { t } = useLocale();
  const market = useMarket();
  const status = statusForStore(storeId);

  if (status.state === "loading") return null;
  if (status.state === "no_location" || !location) {
    return <p className="rounded-2xl bg-blue-50 px-3 py-2.5 text-xs font-medium text-blue-800">📍 {t("delivery_info.set_location")}</p>;
  }
  if (status.state === "outside") return null;
  const range = marketUi(market.countryCode).deliveryBadges ? etaForStore(storeId) : null;
  return <OptionRows offer={{ ...status, etaText: range ? formatEta(range) : null }} />;
}

/** The cart: one delivery line per shipment (one per supplier), each with its own method, time and fee, so
 * the shopper sees what arrives when before checkout. A single shipment keeps the compact Express / Standard rows. */
export function CartDeliveryOptions({ storeIds }: { storeIds: (string | null)[] }) {
  const { statusForStore, location, etaAt } = useDeliveryLocation();
  const { t } = useLocale();
  const money = useMoney();
  const market = useMarket();
  const offsetMin = marketOffsetMinutes(market.countryCode);
  const pricing = pricingFor(market.countryCode);
  const { locale } = useLocale();
  const { stores } = useAllStores();
  const calculated = marketUi(market.countryCode).deliveryBadges;
  const unique = [...new Set(storeIds)];
  const statuses = unique.map((id) => statusForStore(id));

  if (statuses.some((st) => st.state === "loading")) return null;
  if (!location || statuses.some((st) => st.state === "no_location")) {
    return <p className="rounded-2xl bg-blue-50 px-3 py-2.5 text-xs font-medium text-blue-800">📍 {t("delivery_info.set_location")}</p>;
  }
  const ok = statuses.filter((st): st is Extract<typeof st, { state: "ok" }> => st.state === "ok");
  if (ok.length === 0) return null;

  if (unique.length > 1) {
    return (
      <section className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-neutral-500">{unique.length} separate deliveries, each with its own time. You pay one delivery fee for the whole cart.</p>
        {unique.map((id, i) => {
          const st = statuses[i];
          if (st.state !== "ok") return null;
          const name = id ? stores.find((x) => x.id === id)?.name ?? "Shop" : "FasTrack";
          const range = calculated && st.express ? etaAt(location.lat, location.lng, [id]) : null;
          const express = st.express;
          return (
            <Row
              key={id ?? "own"}
              icon={express ? "🛵" : "📦"}
              title={name}
              ok={st.express || st.standard}
              detail={
                express
                  ? `${t("checkout.express")} · ${range ? formatEta(range) : t("delivery_info.express_eta")}`
                  : st.standard
                    ? `${t("checkout.standard")} · ${t("delivery_info.standard_by", { date: formatDeliveryDate(standardDeliveryDate(st.standardDays, new Date(), offsetMin), locale) })}`
                    : t("delivery_info.standard_unavailable")
              }
            />
          );
        })}
      </section>
    );
  }

  return (
    <OptionRows
      offer={{
        express: ok.every((st) => st.express),
        standard: ok.every((st) => st.standard),
        standardDays: Math.max(...ok.map((st) => st.standardDays)),
        expressRadiusKm: ok.find((st) => !st.express)?.expressRadiusKm ?? ok[0].expressRadiusKm,
        etaText: calculated ? (() => { const r = etaAt(location.lat, location.lng, unique); return r ? formatEta(r) : null; })() : null,
      }}
    />
  );
}
