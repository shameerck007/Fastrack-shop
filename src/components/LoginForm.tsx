"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveLoginEmail } from "@/lib/actions/auth";
import Wordmark from "@/components/Wordmark";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import { useLocale } from "@/components/LocaleProvider";

type Mode = "password" | "otp";
type IdentifierType = "email" | "phone";

function LoginFormInner({ defaultCountryCode }: { defaultCountryCode: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<Mode>("password");
  const [identifierType, setIdentifierType] = useState<IdentifierType>("email");

  // password mode
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // otp mode
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStage, setOtpStage] = useState<"enter-email" | "enter-code">("enter-email");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const identifier = identifierType === "email" ? email : phone;
    const resolvedEmail = await resolveLoginEmail(identifier);
    if (!resolvedEmail) {
      setLoading(false);
      setError(t("auth.invalid_credentials"));
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });

    setLoading(false);
    if (error) {
      setError(t("auth.invalid_credentials"));
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

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-10">
      <Link href="/" className="mb-6">
        <Wordmark height={32} />
      </Link>

      <div className="w-full rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t("auth.sign_in_title")}</h1>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "password" ? "otp" : "password");
              setError(null);
              setOtpError(null);
            }}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {mode === "password" ? t("auth.sign_in_with_code") : t("auth.sign_in_with_password")}
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div className="flex rounded-lg bg-neutral-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => setIdentifierType("email")}
                className={`flex-1 rounded-md py-1.5 font-medium transition ${
                  identifierType === "email" ? "bg-white shadow-sm" : "text-neutral-500"
                }`}
              >
                {t("auth.email")}
              </button>
              <button
                type="button"
                onClick={() => setIdentifierType("phone")}
                className={`flex-1 rounded-md py-1.5 font-medium transition ${
                  identifierType === "phone" ? "bg-white shadow-sm" : "text-neutral-500"
                }`}
              >
                {t("auth.mobile_number")}
              </button>
            </div>

            {identifierType === "email" ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-neutral-800">{t("auth.email")}</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-neutral-800">{t("auth.mobile_number")}</span>
                <PhoneNumberInput
                  value={phone}
                  onChange={setPhone}
                  defaultCountryCode={defaultCountryCode}
                  placeholder={t("auth.mobile_number_national_placeholder")}
                />
              </label>
            )}

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-800">{t("auth.password")}</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-blue-700 py-2.5 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? t("auth.signing_in") : t("auth.sign_in_button")}
            </button>

            <p className="text-xs text-neutral-500">{t("auth.terms_notice")}</p>
          </form>
        ) : otpStage === "enter-email" ? (
          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-800">{t("auth.email")}</span>
              <input
                type="email"
                required
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>

            {otpError && <p className="text-sm text-red-600">{otpError}</p>}

            <button
              type="submit"
              disabled={otpLoading}
              className="rounded-full bg-blue-700 py-2.5 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
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
                className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-lg tracking-[0.3em] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>

            {otpError && <p className="text-sm text-red-600">{otpError}</p>}

            <button
              type="submit"
              disabled={otpLoading}
              className="rounded-full bg-blue-700 py-2.5 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
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
      </div>

      <div className="my-5 flex w-full items-center gap-3">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs text-neutral-400">{t("auth.new_to_fastrack")}</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <Link
        href={`/register${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
        className="w-full rounded-full border border-neutral-300 bg-white py-2.5 text-center text-sm font-medium hover:bg-neutral-50"
      >
        {t("auth.create_account_button")}
      </Link>
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
