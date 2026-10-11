"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_CURRENCY, moneyFor, type MoneyFormatter } from "@/lib/money";
import { pricingFor, type DeliveryPricing } from "@/lib/delivery-methods";

interface Ctx {
  currency: string;
  countryCode: string;
  money: MoneyFormatter;
  pricing: DeliveryPricing;
}

const MoneyCtx = createContext<Ctx>({ currency: DEFAULT_CURRENCY, countryCode: "SA", money: moneyFor(DEFAULT_CURRENCY), pricing: pricingFor("SA") });

/** The current market's currency, available to every client component. */
export default function MoneyProvider({ currency, countryCode = "SA", pricing, children }: { currency: string; countryCode?: string; pricing?: DeliveryPricing; children: React.ReactNode }) {
  const value = useMemo(() => ({ currency, countryCode, money: moneyFor(currency), pricing: pricing ?? pricingFor(countryCode) }), [currency, countryCode, pricing]);
  return <MoneyCtx.Provider value={value}>{children}</MoneyCtx.Provider>;
}

/** Format an amount in the market's currency: `const money = useMoney(); money(12.5)`. */
export function useMoney(): MoneyFormatter {
  return useContext(MoneyCtx).money;
}

export function useCurrency(): string {
  return useContext(MoneyCtx).currency;
}

/** The market the shopper (or staff member) is working in. */
export function useMarket(): { currency: string; countryCode: string } {
  const { currency, countryCode } = useContext(MoneyCtx);
  return { currency, countryCode };
}

/** What delivery costs in this market (the admin's fees over the defaults). */
export function usePricing(): DeliveryPricing {
  return useContext(MoneyCtx).pricing;
}
