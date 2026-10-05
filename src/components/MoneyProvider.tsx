"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_CURRENCY, moneyFor, type MoneyFormatter } from "@/lib/money";

interface Ctx {
  currency: string;
  money: MoneyFormatter;
}

const MoneyCtx = createContext<Ctx>({ currency: DEFAULT_CURRENCY, money: moneyFor(DEFAULT_CURRENCY) });

/** The current market's currency, available to every client component. */
export default function MoneyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  const value = useMemo(() => ({ currency, money: moneyFor(currency) }), [currency]);
  return <MoneyCtx.Provider value={value}>{children}</MoneyCtx.Provider>;
}

/** Format an amount in the market's currency: `const money = useMoney(); money(12.5)`. */
export function useMoney(): MoneyFormatter {
  return useContext(MoneyCtx).money;
}

export function useCurrency(): string {
  return useContext(MoneyCtx).currency;
}
