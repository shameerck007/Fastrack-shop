"use client";

import { useState } from "react";
import { BRAND_NAME, cvcLength, detectBrand, formatCardNumber, formatExpiry, type CardBrand, type CardErrors, type CardInput } from "@/lib/card";
import { Field, inputClass } from "@/components/ui/Form";
import type { SavedCard } from "@/lib/actions/payments";

/** What the shopper has chosen to pay with: cash, a new card, Apple Pay, or one of their saved cards ("saved:<id>"). */
export type PayChoice = "cod" | "card" | "apple" | `saved:${string}`;

const BRAND_TONE: Record<CardBrand, string> = {
  mada: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  visa: "bg-brand-50 text-brand-800 ring-brand-200",
  mastercard: "bg-amber-50 text-amber-800 ring-amber-200",
  amex: "bg-sky-50 text-sky-800 ring-sky-200",
  unionpay: "bg-rose-50 text-rose-800 ring-rose-200",
  unknown: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

export function BrandBadge({ brand }: { brand: string }) {
  const b = (["mada", "visa", "mastercard", "amex", "unionpay"].includes(brand) ? brand : "unknown") as CardBrand;
  return <span className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-extrabold uppercase tracking-wide ring-1 ${BRAND_TONE[b]}`}>{BRAND_NAME[b]}</span>;
}

const expiryText = (c: SavedCard) => (c.expMonth && c.expYear ? `${String(c.expMonth).padStart(2, "0")}/${String(c.expYear).slice(-2)}` : null);
const expired = (c: SavedCard) => !!(c.expMonth && c.expYear && (c.expYear < new Date().getFullYear() || (c.expYear === new Date().getFullYear() && c.expMonth < new Date().getMonth() + 1)));

function Row({ selected, onSelect, icon, title, hint, children, disabled }: { selected: boolean; onSelect: () => void; icon: React.ReactNode; title: React.ReactNode; hint?: React.ReactNode; children?: React.ReactNode; disabled?: boolean }) {
  return (
    <div className={`rounded-2xl border transition ${selected ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600" : "border-neutral-200 bg-white"} ${disabled ? "opacity-60" : ""}`}>
      <button type="button" onClick={onSelect} disabled={disabled} aria-pressed={selected} className="flex w-full items-center gap-3 p-3 text-start">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-neutral-100">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-neutral-900">{title}</span>
          {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
        </span>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${selected ? "bg-brand-700 text-white" : "border border-neutral-300 text-transparent"}`}>✓</span>
      </button>
      {selected && children && <div className="border-t border-brand-100 px-3 pb-3 pt-3">{children}</div>}
    </div>
  );
}

export interface PaymentOptionsProps {
  codTitle: string;
  codHint: string;
  onlineEnabled: boolean;
  appleAvailable: boolean;
  savedCards: SavedCard[];
  value: PayChoice;
  onChange: (v: PayChoice) => void;
  card: CardInput;
  onCard: (c: CardInput) => void;
  errors: CardErrors;
  saveCard: boolean;
  onSaveCard: (v: boolean) => void;
  savedCvc: string;
  onSavedCvc: (v: string) => void;
  savedCvcError?: string | null;
}

/** The "Payment" section of checkout: cash, saved cards, a new card (with live checks) and Apple Pay. */
export default function PaymentOptions(p: PaymentOptionsProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const brand = detectBrand(p.card.number);
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  const err = (k: keyof CardErrors) => (touched[k] ? p.errors[k] ?? null : null);
  const set = (patch: Partial<CardInput>) => p.onCard({ ...p.card, ...patch });

  return (
    <div className="flex flex-col gap-2.5">
      {p.onlineEnabled && p.appleAvailable && (
        <Row selected={p.value === "apple"} onSelect={() => p.onChange("apple")} icon={""} title="Apple Pay" hint="Pay with Face ID or Touch ID. mada, Visa and Mastercard cards in your Wallet." />
      )}

      {p.onlineEnabled &&
        p.savedCards.map((c) => (
          <Row
            key={c.id}
            selected={p.value === `saved:${c.id}`}
            onSelect={() => p.onChange(`saved:${c.id}`)}
            disabled={expired(c)}
            icon="💳"
            title={
              <span className="flex flex-wrap items-center gap-2">
                <BrandBadge brand={c.brand} />
                <span className="font-mono tracking-wider">•••• {c.last4}</span>
              </span>
            }
            hint={expired(c) ? "This card has expired" : [c.holderName, expiryText(c) && `Expires ${expiryText(c)}`].filter(Boolean).join(" · ")}
          >
            <Field label="Security code (CVC)" error={p.savedCvcError} className="max-w-[10rem]">
              <input
                value={p.savedCvc}
                onChange={(e) => p.onSavedCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder={c.brand === "amex" ? "4 digits" : "3 digits"}
                maxLength={4}
                className={inputClass}
              />
            </Field>
          </Row>
        ))}

      {p.onlineEnabled && (
        <Row selected={p.value === "card"} onSelect={() => p.onChange("card")} icon="💳" title="Credit or debit card" hint="mada, Visa, Mastercard, American Express">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Card number" error={err("number")} className="sm:col-span-2">
              <div className="relative">
                <input
                  value={p.card.number}
                  onChange={(e) => set({ number: formatCardNumber(e.target.value) })}
                  onBlur={() => touch("number")}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 5678 9012 3456"
                  aria-invalid={!!err("number")}
                  className={`${inputClass} pe-24 font-mono tracking-wider ${err("number") ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" : ""}`}
                />
                {brand !== "unknown" && (
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2">
                    <BrandBadge brand={brand} />
                  </span>
                )}
              </div>
            </Field>
            <Field label="Name on card" error={err("name")} className="sm:col-span-2">
              <input
                value={p.card.name}
                onChange={(e) => set({ name: e.target.value.replace(/[^A-Za-z .'-]/g, "").slice(0, 60) })}
                onBlur={() => touch("name")}
                autoComplete="cc-name"
                placeholder="As printed on the card"
                aria-invalid={!!err("name")}
                className={`${inputClass} ${err("name") ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" : ""}`}
              />
            </Field>
            <Field label="Expiry (MM/YY)" error={err("expiry")}>
              <input
                value={p.card.expiry}
                onChange={(e) => set({ expiry: formatExpiry(e.target.value, p.card.expiry) })}
                onBlur={() => touch("expiry")}
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                maxLength={5}
                aria-invalid={!!err("expiry")}
                className={`${inputClass} ${err("expiry") ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" : ""}`}
              />
            </Field>
            <Field label="Security code (CVC)" error={err("cvc")}>
              <input
                value={p.card.cvc}
                onChange={(e) => set({ cvc: e.target.value.replace(/\D/g, "").slice(0, cvcLength(brand)) })}
                onBlur={() => touch("cvc")}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder={brand === "amex" ? "4 digits" : "3 digits"}
                aria-invalid={!!err("cvc")}
                className={`${inputClass} ${err("cvc") ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" : ""}`}
              />
            </Field>
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-neutral-700">
            <input type="checkbox" checked={p.saveCard} onChange={(e) => p.onSaveCard(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-brand-700" />
            <span>
              Save this card for next time
              <span className="block text-xs text-neutral-500">Securely stored by our payment provider. We never see or keep your full card number or security code.</span>
            </span>
          </label>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
            <span aria-hidden>🔒</span> Payments are encrypted and confirmed with your bank (3-D Secure).
          </p>
        </Row>
      )}

      <Row selected={p.value === "cod"} onSelect={() => p.onChange("cod")} icon="💵" title={p.codTitle} hint={p.codHint} />
    </div>
  );
}
