// Money formatting for every market. Never hard-code a currency: use the current market's
// (client: useMoney(), server: await getMoney()) or an order's own currency.

export const DEFAULT_CURRENCY = "SAR";

const LOCALE_FOR_CURRENCY: Record<string, string> = {
  SAR: "en-SA",
  INR: "en-IN",
  AED: "en-AE",
  USD: "en-US",
};

export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(LOCALE_FOR_CURRENCY[currency] ?? "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export type MoneyFormatter = (amount: number) => string;

export function moneyFor(currency: string = DEFAULT_CURRENCY): MoneyFormatter {
  return (amount) => formatMoney(amount, currency);
}
