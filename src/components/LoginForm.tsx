"use client";

import { Suspense, useState } from "react";
import Link from "@/components/Link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { emailHasAccount, resolveLoginEmail } from "@/lib/actions/auth";
import Wordmark from "@/components/Wordmark";
import { COUNTRIES, findCountry } from "@/lib/countries";
import { useLocale } from "@/components/LocaleProvider";

type Mode = "password" | "otp";
type Step = "identifier" | "password" | "phone-password" | "phone-code" | "phone-new";

/** Turns a free-typed mobile number into E.164 using the visitor's detected
 * country when no "+" prefix was typed, or null if the digit count can't be
 * a real number (E.164 allows at most 15 digits; under 7 is never valid). */
function normalizePhone(raw: string, defaultCountryCode: string): string | null {
  const trimmed = raw.trim();
  const explicit = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  const national = explicit ? digits : digits.replace(/^0+/, "");
  if (national.length < 7 || national.length > 15) return null;
  return explicit ? `+${digits}` : `${findCountry(defaultCountryCode).dial}${national}`;
}

/** "🇮🇳 +91 9243231121" — same display Amazon shows once it has figured out
 * which country a typed number belongs to. */
function describePhone(e164: string): string {
  const country = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => e164.startsWith(c.dial));
  if (!country) return e164;
  return `${country.flag} ${country.code} ${country.dial} ${e164.slice(country.dial.length)}`;
}

function LoginFormInner({ defaultCountryCode }: { defaultCountryCode: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<Mode>("password");
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneEmail, setPhoneEmail] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noAccountEmail, setNoAccountEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // standalone "Sign in with a code" (email) mode
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStage, setOtpStage] = useState<"enter-email" | "enter-code">("enter-email");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (identifier.includes("@")) {
      const email = identifier.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError(t("auth.invalid_email"));
        return;
      }
      setLoading(true);
      const exists = await emailHasAccount(email);
      setLoading(false);
      // false = definitely no account; null = could not check, so carry on to the password as before.
      if (exists === false) {
        setNoAccountEmail(email);
        return;
      }
      setNoAccountEmail(null);
      setStep("password");
      return;
    }

    const normalized = normalizePhone(identifier, defaultCountryCode);
    if (!normalized) {
      setError(t("auth.invalid_mobile_number"));
      return;
    }

    setLoading(true);
    const email = await resolveLoginEmail(normalized);
    setPhone(normalized);

    if (!email) {
      setLoading(false);
      setStep("phone-new");
      return;
    }

    setLoading(false);
    setPhoneEmail(email);
    setStep("phone-password");
  }

  async function handleSendPhoneCode() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: phoneEmail,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      setError(t("auth.could_not_send_code"));
      return;
    }
    setStep("phone-code");
  }

  async function handlePhonePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail, password });

    setLoading(false);
    if (error) {
      setError(t("auth.invalid_credentials"));
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: identifier.trim(), password });

    setLoading(false);
    if (error) {
      setError(t("auth.invalid_credentials"));
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function handlePhoneCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: phoneEmail, token: phoneCode, type: "email" });

    setLoading(false);
    if (error) {
      setError(t("auth.invalid_code"));
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: otpEmail,
      options: { shouldCreateUser: false },
    });

    setOtpLoading(false);
    if (error) {
      setOtpError(t("auth.invalid_credentials"));
      return;
    }
    setOtpStage("enter-code");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: otpEmail, token: otpCode, type: "email" });

    setOtpLoading(false);
    if (error) {
      setOtpError(t("auth.invalid_code"));
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  function backToIdentifier() {
    setStep("identifier");
    setPassword("");
    setPhoneCode("");
    setError(null);
  }

  const inputClass =
    "h-12 rounded-xl border border-neutral-300 bg-white px-4 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
  const primaryButton =
    "flex h-12 items-center justify-center rounded-full bg-blue-700 text-base font-extrabold text-white shadow-lg shadow-blue-700/20 transition active:scale-[0.98] hover:bg-blue-800 disabled:opacity-50";

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-5 pb-10 pt-6 md:py-10">
      <Link href="/" className="mb-5 md:mb-6">
        <Wordmark height={34} />
      </Link>

      <div className="w-full md:rounded-2xl md:border md:border-neutral-200 md:bg-white md:p-6 md:shadow-sm">
        <div className="mb-5 text-center md:text-start">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            {mode === "password" && step === "phone-new" ? t("auth.new_here_heading") : t("auth.welcome_title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{t("auth.welcome_sub")}</p>
        </div>

        {mode === "password" ? (
          step === "identifier" ? (
            <form onSubmit={handleContinue} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-neutral-800">{t("auth.email_or_mobile")}</span>
                <input
                  required
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setNoAccountEmail(null);
                  }}
                  placeholder={t("auth.email_or_mobile_placeholder")}
                  className={inputClass}
                />
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {noAccountEmail && (
                <div className="rounded-2xl bg-blue-50 p-4 text-center">
                  <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow-sm">👋</span>
                  <p className="text-base font-extrabold text-blue-950">{t("auth.no_account_email")}</p>
                  <p className="mt-1 break-all text-xs text-blue-900/70">{t("auth.no_account_hint", { email: noAccountEmail })}</p>
                  <Link
                    href={`/register?email=${encodeURIComponent(noAccountEmail)}${redirectTo !== "/" ? `&redirect=${encodeURIComponent(redirectTo)}` : ""}`}
                    className={`${primaryButton} mt-3`}
                  >
                    {t("auth.create_account_for_email")}
                  </Link>
                </div>
              )}

              {!noAccountEmail && (
                <button type="submit" disabled={loading} className={primaryButton}>
                  {loading ? t("auth.checking") : t("auth.continue")}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode("otp");
                  setError(null);
                  setOtpError(null);
                }}
                className="h-12 rounded-full border border-neutral-300 bg-white text-sm font-bold text-neutral-800 active:scale-[0.98]"
              >
                {t("auth.sign_in_with_code")}
              </button>

              <p className="text-center text-xs text-neutral-500">{t("auth.terms_notice")}</p>
            </form>
          ) : step === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-neutral-600">
                {t("auth.signing_in_as", { identifier })}{" "}
                <button type="button" onClick={backToIdentifier} className="font-medium text-blue-600 hover:underline">
                  {t("auth.change")}
                </button>
              </p>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-neutral-800">{t("auth.password")}</span>
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button type="submit" disabled={loading} className={primaryButton}>
                {loading ? t("auth.signing_in") : t("auth.sign_in_button")}
              </button>
            </form>
          ) : step === "phone-password" ? (
            <form onSubmit={handlePhonePasswordSubmit} className="flex flex-col gap-4">
              <p className="text-sm font-medium text-neutral-800">
                {describePhone(phone)}{" "}
                <button type="button" onClick={backToIdentifier} className="font-medium text-blue-600 hover:underline">
                  {t("auth.change")}
                </button>
              </p>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-neutral-800">{t("auth.password")}</span>
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button type="submit" disabled={loading} className={primaryButton}>
                {loading ? t("auth.signing_in") : t("auth.sign_in_button")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSendPhoneCode}
                className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                {t("auth.email_me_a_code")}
              </button>
            </form>
          ) : step === "phone-code" ? (
            <form onSubmit={handlePhoneCodeSubmit} className="flex flex-col gap-4">
              <p className="text-sm font-medium text-neutral-800">
                {describePhone(phone)}{" "}
                <button type="button" onClick={backToIdentifier} className="font-medium text-blue-600 hover:underline">
                  {t("auth.change")}
                </button>
              </p>
              <p className="text-sm text-neutral-600">{t("auth.code_sent_to_account_email")}</p>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-neutral-800">{t("auth.verification_code")}</span>
                <input
                  required
                  inputMode="numeric"
                  autoFocus
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  placeholder={t("auth.verification_code_placeholder")}
                  className={`${inputClass} text-center text-lg tracking-[0.3em]`}
                />
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button type="submit" disabled={loading} className={primaryButton}>
                {loading ? t("auth.verifying") : t("auth.verify_and_sign_in")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("phone-password");
                  setPhoneCode("");
                  setError(null);
                }}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                {t("auth.use_password_instead")}
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium text-neutral-800">
                {describePhone(phone)}{" "}
                <button type="button" onClick={backToIdentifier} className="font-medium text-blue-600 hover:underline">
                  {t("auth.change")}
                </button>
              </p>
              <p className="text-sm text-neutral-600">{t("auth.new_here_mobile_notice")}</p>
              <Link
                href={`/register?phone=${encodeURIComponent(phone)}${
                  redirectTo !== "/" ? `&redirect=${encodeURIComponent(redirectTo)}` : ""
                }`}
                className={`${primaryButton} text-center`}
              >
                {t("auth.proceed_create_account")}
              </Link>
            </div>
          )
        ) : otpStage === "enter-email" ? (
          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-800">{t("auth.email")}</span>
              <input
                type="email"
                required
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                className={inputClass}
              />
            </label>

            {otpError && <p className="text-sm text-red-600">{otpError}</p>}

            <button type="submit" disabled={otpLoading} className={primaryButton}>
              {otpLoading ? t("auth.sending_code") : t("auth.send_code")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
            <p className="text-sm text-neutral-600">{t("auth.code_sent_notice", { email: otpEmail })}</p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-800">{t("auth.verification_code")}</span>
              <input
                required
                inputMode="numeric"
                autoFocus
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder={t("auth.verification_code_placeholder")}
                className={`${inputClass} text-center text-lg tracking-[0.3em]`}
              />
            </label>

            {otpError && <p className="text-sm text-red-600">{otpError}</p>}

            <button type="submit" disabled={otpLoading} className={primaryButton}>
              {otpLoading ? t("auth.verifying") : t("auth.verify_and_sign_in")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOtpStage("enter-email");
                setOtpCode("");
                setOtpError(null);
              }}
              className="text-sm text-neutral-500 hover:underline"
            >
              {t("auth.back")}
            </button>
          </form>
        )}

        {mode === "otp" && (
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setError(null);
              setOtpError(null);
            }}
            className="mt-4 w-full text-center text-sm font-bold text-blue-700 hover:underline"
          >
            {t("auth.sign_in_with_password")}
          </button>
        )}
      </div>

    </div>
  );
}

export default function LoginForm({ defaultCountryCode }: { defaultCountryCode: string }) {
  return (
    <Suspense>
      <LoginFormInner defaultCountryCode={defaultCountryCode} />
    </Suspense>
  );
}
