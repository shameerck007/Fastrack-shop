"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_CURRENCY, moneyFor, type MoneyFormatter } from "@/lib/money";

interface Ctx {
  currency: string;
  countryCode: string;
  money: MoneyFormatter;
}

const MoneyCtx = createContext<Ctx>({ currency: DEFAULT_CURRENCY, countryCode: "SA", money: moneyFor(DEFAULT_CURRENCY) });

/** The current market's currency, available to every client component. */
export default function MoneyProvider({ currency, countryCode = "SA", children }: { currency: string; countryCode?: string; children: React.ReactNode }) {
  const value = useMemo(() => ({ currency, countryCode, money: moneyFor(currency) }), [currency, countryCode]);
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
