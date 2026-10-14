"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { beginPasskeyRegistration, finishPasskeyRegistration, removePasskey, type PasskeyInfo } from "@/lib/actions/passkeys";
import { createPasskey, deviceLabel, passkeyCancelled, passkeyErrorText, passkeysAvailable, writeAppLock, type AppLockSettings } from "@/lib/passkey-client";
import { unwrapAction } from "@/lib/errors";
import { useDialogs } from "@/components/ui/Dialogs";
import { inputClass, primaryButton } from "@/components/ui/Form";

const HERE = "ft_passkey_here";
const DELAYS = [
  { value: 0, label: "Every time I open the app" },
  { value: 1, label: "After 1 minute away" },
  { value: 5, label: "After 5 minutes away" },
  { value: 15, label: "After 15 minutes away" },
];

// This device's own settings live in its local storage; these read them in a way that follows changes and is safe on the server.
const subscribe = (cb: () => void) => {
  window.addEventListener("ft-applock-changed", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("ft-applock-changed", cb);
    window.removeEventListener("storage", cb);
  };
};
const readLocal = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const card = "rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-100";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : null);

/** Account > Login and security: sign in with this phone's face, fingerprint, PIN or pattern, and lock the app with it. */
export default function DeviceSecurityCard({ passkeys }: { passkeys: PasskeyInfo[] }) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [available, setAvailable] = useState<boolean | null>(null);
  const hereId = useSyncExternalStore(subscribe, () => readLocal(HERE), () => null);
  const lockRaw = useSyncExternalStore(subscribe, () => readLocal("ft_applock"), () => null);
  const lock = useMemo(() => {
    try {
      const v = JSON.parse(lockRaw ?? "null") as AppLockSettings | null;
      return { enabled: !!v?.enabled, delayMin: v?.delayMin ?? 1 };
    } catch {
      return { enabled: false, delayMin: 1 };
    }
  }, [lockRaw]);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    passkeysAvailable().then((a) => live && setAvailable(a));
    return () => {
      live = false;
    };
  }, []);

  // This device is added when one of the saved passkeys is the one this browser remembers.
  const hereKnown = !!hereId && passkeys.some((p) => p.credentialId === hereId);
  // The phone's keychain is shared by Safari and the home-screen app, but their local storage is not: so "has a passkey" (on the
  // account) is what allows the app lock, not "this browser remembers registering it".
  const hasPasskey = passkeys.length > 0;

  function addThisDevice() {
    setMessage(null);
    start(async () => {
      try {
        const begin = (await unwrapAction(beginPasskeyRegistration)()) as { challengeId: string; options: Record<string, unknown> };
        const { credentialId, proof } = await createPasskey(begin.options);
        await unwrapAction(finishPasskeyRegistration)(begin.challengeId, credentialId, proof, deviceLabel());
        try {
          localStorage.setItem(HERE, credentialId);
          window.dispatchEvent(new Event("ft-applock-changed"));
        } catch {
          /* ignore */
        }
        setMessage({ kind: "ok", text: "Done. You can now sign in with this phone's face, fingerprint, PIN or pattern." });
        router.refresh();
      } catch (e) {
        if (e instanceof DOMException && e.name === "InvalidStateError") setMessage({ kind: "ok", text: "This phone already has a FasTrack passkey (Safari and the home-screen app share it). You can turn on App lock below." });
        else if (!passkeyCancelled(e)) setMessage({ kind: "error", text: passkeyErrorText(e) });
      }
    });
  }

  async function remove(p: PasskeyInfo) {
    const ok = await confirm({ title: `Remove "${p.deviceName}"?`, message: "You will no longer be able to sign in with that device's face, fingerprint or screen lock. Your password still works.", confirmLabel: "Remove device", danger: true, icon: "🔐" });
    if (!ok) return;
    start(async () => {
      try {
        await unwrapAction(removePasskey)(p.id);
        if (p.credentialId === hereId) {
          writeAppLock(null);
          try {
            localStorage.removeItem(HERE);
            window.dispatchEvent(new Event("ft-applock-changed"));
          } catch {
            /* ignore */
          }
        }
        router.refresh();
      } catch (e) {
        setMessage({ kind: "error", text: passkeyErrorText(e) });
      }
    });
  }

  function setAppLock(enabled: boolean, delayMin: number) {
    if (!hasPasskey) return;
    writeAppLock(enabled ? { enabled: true, delayMin } : null);
    // Turning it on counts as unlocked for this visit.
    if (enabled) {
      try {
        sessionStorage.setItem("ft_unlocked", "1");
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <section className={card}>
        <h2 className="text-base font-extrabold tracking-tight text-neutral-900">Face, fingerprint or screen-lock sign-in</h2>
        <p className="mt-1 text-sm text-neutral-500">Sign in with the same face, fingerprint, PIN or pattern you use to unlock this phone. FasTrack never sees them: your phone checks and tells us it is you.</p>

        {available === false && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This device can&apos;t use it. Set a screen lock (PIN, pattern, fingerprint or face) in your phone&apos;s settings, and use an up-to-date browser.</p>}

        {passkeys.length > 0 && (
          <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a6 6 0 0 0-6 6v2" />
                    <path d="M18 11V9a6 6 0 0 0-9.5-4.9" />
                    <path d="M9 21c0-4 1.5-5 1.5-9a1.5 1.5 0 0 1 3 0c0 3-.5 6.5-2 9" />
                    <path d="M15 21c1-3 1.5-5.500 1.500-9" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-neutral-900">
                    {p.deviceName}
                    {p.credentialId === hereId && <span className="ms-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-800">This device</span>}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    Added {when(p.createdAt)}
                    {p.lastUsedAt ? ` · last used ${when(p.lastUsedAt)}` : ""}
                  </p>
                </div>
                <button type="button" disabled={pending} onClick={() => remove(p)} className="h-8 shrink-0 rounded-full border border-neutral-300 px-3 text-xs font-bold text-neutral-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {available && !hereKnown && (
          <button type="button" disabled={pending} onClick={addThisDevice} className={`${primaryButton} mt-4`}>
            {pending ? "Waiting for your phone…" : "Enable on this device"}
          </button>
        )}
        {message && <p className={`mt-3 rounded-xl p-3 text-sm font-medium ${message.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{message.text}</p>}
      </section>

      <section className={card}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-neutral-900">App lock</h2>
            <p className="mt-1 text-sm text-neutral-500">Ask for your face, fingerprint, PIN or pattern when you open FasTrack on this phone, so nobody else can use your account.</p>
          </div>
          <label className={`relative inline-flex h-7 w-12 shrink-0 items-center ${hasPasskey ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <input type="checkbox" role="switch" aria-label="App lock" checked={lock.enabled && hasPasskey} disabled={!hasPasskey} onChange={(e) => setAppLock(e.target.checked, lock.delayMin)} className="peer sr-only" />
            <span className="absolute inset-0 rounded-full bg-neutral-300 transition peer-checked:bg-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40" />
            <span className="absolute start-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
          </label>
        </div>
        {!hasPasskey && <p className="mt-3 text-xs text-neutral-500">Enable sign-in on this phone above first.</p>}
        {hasPasskey && lock.enabled && (
          <div className="mt-4 max-w-xs">
            <label className="mb-1.5 block text-xs font-semibold text-neutral-700" htmlFor="applock-delay">
              Lock
            </label>
            <select id="applock-delay" value={lock.delayMin} onChange={(e) => setAppLock(true, Number(e.target.value))} className={inputClass}>
              {DELAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>
    </div>
  );
}
