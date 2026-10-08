"use client";

import { useState, useTransition } from "react";
import { updateProfile, updatePassword } from "@/lib/actions/profile";
import { useLocale } from "@/components/LocaleProvider";
import PhoneNumberInput from "@/components/PhoneNumberInput";

export default function AccountSecurityForm({
  initialName,
  initialPhone,
  email,
  defaultCountryCode,
}: {
  initialName: string;
  initialPhone: string;
  email: string;
  defaultCountryCode: string;
}) {
  const { t } = useLocale();

  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [profilePending, startProfileTransition] = useTransition();
  const [profileMessage, setProfileMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, startPasswordTransition] = useTransition();
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMessage(null);
    if (!fullName.trim()) {
      setProfileMessage({ ok: false, text: t("account_security.name_required") });
      return;
    }
    startProfileTransition(async () => {
      try {
        await updateProfile({ fullName, phone });
        setProfileMessage({ ok: true, text: t("account_security.profile_updated") });
      } catch (err) {
        setProfileMessage({
          ok: false,
          text: err instanceof Error ? err.message : t("account_security.could_not_update"),
        });
      }
    });
  }

  function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordMessage({ ok: false, text: t("account_security.password_too_short") });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ ok: false, text: t("account_security.passwords_dont_match") });
      return;
    }
    startPasswordTransition(async () => {
      try {
        await updatePassword(newPassword);
        setNewPassword("");
        setConfirmPassword("");
        setPasswordMessage({ ok: true, text: t("account_security.password_updated") });
      } catch (err) {
        setPasswordMessage({
          ok: false,
          text: err instanceof Error ? err.message : t("account_security.could_not_update_password"),
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={saveProfile} className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 font-medium">{t("account_security.profile_section")}</h2>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">{t("account_security.full_name")}</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">{t("account_security.phone")}</span>
            <PhoneNumberInput
              value={phone}
              onChange={setPhone}
              defaultCountryCode={defaultCountryCode}
              placeholder={t("account_security.phone_placeholder")}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">{t("account_security.email")}</span>
            <input
              value={email}
              disabled
              className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500"
            />
            <span className="text-xs text-neutral-400">{t("account_security.email_locked_hint")}</span>
          </label>
        </div>

        {profileMessage && (
          <p className={`mt-3 text-sm ${profileMessage.ok ? "text-emerald-600" : "text-red-600"}`}>
            {profileMessage.text}
          </p>
        )}

        <button
          type="submit"
          disabled={profilePending}
          className="mt-4 rounded-full bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {profilePending ? t("account_security.saving") : t("account_security.save_changes")}
        </button>
      </form>

      <form onSubmit={changePassword} className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 font-medium">{t("account_security.password_section")}</h2>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">{t("account_security.new_password")}</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">{t("account_security.confirm_password")}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
        </div>

        {passwordMessage && (
          <p className={`mt-3 text-sm ${passwordMessage.ok ? "text-emerald-600" : "text-red-600"}`}>
            {passwordMessage.text}
          </p>
        )}

        <button
          type="submit"
          disabled={passwordPending}
          className="mt-4 rounded-full bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {passwordPending ? t("account_security.updating_password") : t("account_security.update_password")}
        </button>
      </form>
    </div>
  );
}
