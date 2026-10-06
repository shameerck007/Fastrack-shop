"use client";

import { Suspense, useState } from "react";
import Link from "@/components/Link";
import { useRouter, useSearchParams } from "next/navigation";
import { readTenantCookie } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import { useLocale } from "@/components/LocaleProvider";

function RegisterFormInner({ defaultCountryCode }: { defaultCountryCode: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();

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
      router.push(redirectTo);
      router.refresh();
    } else {
      setNotice(t("auth.check_email_notice"));
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-10">
      <Link href="/" className="mb-6">
        <Wordmark height={32} />
      </Link>

      <div className="w-full rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold">{t("auth.create_account_title")}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-800">{t("auth.full_name")}</span>
            <input
              required
              placeholder={t("auth.full_name_placeholder")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-800">
              {t("auth.mobile_number")} <span className="font-normal text-neutral-400">{t("auth.mobile_optional")}</span>
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
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-neutral-400">{t("auth.password_hint")}</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="text-sm text-blue-600">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-blue-700 py-2.5 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? t("auth.creating_account") : t("auth.create_account_button")}
          </button>

          <p className="text-xs text-neutral-500">{t("auth.terms_notice")}</p>
        </form>
      </div>

      <p className="mt-5 text-sm text-neutral-600">
        {t("auth.already_have_account")}{" "}
        <Link
          href={`/login${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className="text-blue-600 hover:underline"
        >
          {t("auth.sign_in_link")}
        </Link>
      </p>
    </div>
  );
}

export default function RegisterForm({ defaultCountryCode }: { defaultCountryCode: string }) {
  return (
    <Suspense>
      <RegisterFormInner defaultCountryCode={defaultCountryCode} />
    </Suspense>
  );
}
