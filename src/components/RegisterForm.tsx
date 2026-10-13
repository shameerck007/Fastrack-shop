"use client";


import { unwrapAction } from "@/lib/errors";
import { Suspense, useState } from "react";
import Link from "@/components/Link";
import { useRouter, useSearchParams } from "next/navigation";
import { readTenantCookie } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import { useLocale } from "@/components/LocaleProvider";
import { emailHasAccount } from "@/lib/actions/auth";
import { validatePhone } from "@/lib/countries";
import { CART_CHANGED_EVENT } from "@/lib/cart-events";

type Prefill = { email?: string; phone?: string };

function RegisterFormInner({ defaultCountryCode, modal = false, prefill, onDone, onLogin }: { defaultCountryCode: string; modal?: boolean; prefill?: Prefill; onDone?: () => void; onLogin?: () => void }) {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = modal ? "/" : searchParams.get("redirect") || "/";
  const presetEmail = modal ? prefill?.email ?? "" : searchParams.get("email") ?? "";
  const presetPhone = modal ? prefill?.phone ?? "" : searchParams.get("phone") ?? "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(presetEmail);
  const [phone, setPhone] = useState(presetPhone);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Arrived from the login screen with an email that has no account (Amazon-style): the email is already confirmed there.
  const fromLogin = !!presetEmail;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    // The number is optional, but when given it must be a real mobile number for its country.
    if (phone) {
      const shape = validatePhone(phone);
      if (!shape.ok) {
        setLoading(false);
        setError(shape.error ?? t("auth.invalid_mobile_number"));
        return;
      }
    }

    const supabase = createClient();

    if ((await unwrapAction(emailHasAccount)(email)) === true) {
      setLoading(false);
      setError(t("auth.email_already_registered"));
      return;
    }

    if (phone) {
      const { data: taken } = await supabase.rpc("is_phone_registered", { target_phone: phone });
      if (taken) {
        setLoading(false);
        setError(t("auth.phone_already_registered"));
        return;
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // tenant_id: the market the customer registered in (read by the profile trigger, migration 0046).
      options: { data: { full_name: fullName, phone, tenant_id: readTenantCookie() ?? undefined } },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      if (modal) {
        onDone?.();
        window.dispatchEvent(new Event(CART_CHANGED_EVENT));
        router.refresh();
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } else {
      setNotice(t("auth.check_email_notice"));
    }
  }

  return (
    <div className={modal ? "flex flex-col items-center" : "mx-auto flex max-w-sm flex-col items-center px-4 py-10"}>
      {modal ? (
        <div className="mb-3"><Wordmark height={22} /></div>
      ) : (
        <Link href="/" className="mb-6">
          <Wordmark height={26} />
        </Link>
      )}

      <div className={modal ? "w-full" : "w-full rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"}>
        {fromLogin ? (
          <div className="mb-4">
            <h1 className="text-xl font-semibold">{t("auth.new_here_email_title")}</h1>
            <p className="mt-0.5 text-sm text-neutral-500">{t("auth.new_here_email_sub")}</p>
          </div>
        ) : (
          <h1 className="mb-4 text-xl font-semibold">{t("auth.create_account_title")}</h1>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-800">{t("auth.full_name")}</span>
            <input
              required
              placeholder={t("auth.full_name_placeholder")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-500 hover:border-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center justify-between font-medium text-neutral-800">
              {t("auth.email")}
              {fromLogin && (
                onLogin ? (
                  <button type="button" onClick={onLogin} className="text-xs font-medium text-brand-600 hover:underline">
                    {t("auth.change")}
                  </button>
                ) : (
                  <Link href={`/login${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`} className="text-xs font-medium text-brand-600 hover:underline">
                    {t("auth.change")}
                  </Link>
                )
              )}
            </span>
            <input
              type="email"
              required
              readOnly={fromLogin}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-500 hover:border-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${fromLogin ? "bg-neutral-50 text-neutral-600" : ""} focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-800">
              {t("auth.mobile_number")} <span className="font-normal text-neutral-500">{t("auth.mobile_optional")}</span>
            </span>
            <PhoneNumberInput
              value={phone}
              onChange={setPhone}
              defaultCountryCode={defaultCountryCode}
              placeholder={t("auth.mobile_number_national_placeholder")}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-800">{t("auth.password")}</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-500 hover:border-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <span className="text-xs text-neutral-500">{t("auth.password_hint")}</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="text-sm text-brand-600">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 items-center justify-center rounded-full bg-brand-700 text-[15px] font-bold text-white shadow-md shadow-brand-700/20 transition active:scale-[0.98] hover:bg-brand-800 disabled:opacity-50"
          >
            {loading ? t("auth.creating_account") : t("auth.create_account_button")}
          </button>

          <p className="text-center text-[11px] leading-snug text-neutral-500">{t("auth.terms_notice")}</p>
        </form>
      </div>

      <p className="mt-4 text-sm text-neutral-600">
        {t("auth.already_have_account")}{" "}
        {onLogin ? (
          <button type="button" onClick={onLogin} className="font-medium text-brand-600 hover:underline">
            {t("auth.sign_in_link")}
          </button>
        ) : (
          <Link
            href={`/login${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="text-brand-600 hover:underline"
          >
            {t("auth.sign_in_link")}
          </Link>
        )}
      </p>
    </div>
  );
}

export default function RegisterForm({ defaultCountryCode, modal = false, prefill, onDone, onLogin }: { defaultCountryCode: string; modal?: boolean; prefill?: Prefill; onDone?: () => void; onLogin?: () => void }) {
  return (
    <Suspense>
      <RegisterFormInner defaultCountryCode={defaultCountryCode} modal={modal} prefill={prefill} onDone={onDone} onLogin={onLogin} />
    </Suspense>
  );
}
