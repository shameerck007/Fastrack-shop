"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { beginAppUnlock, finishAppUnlock } from "@/lib/actions/passkeys";
import { getPasskeyAssertion, passkeyCancelled, passkeyErrorText, readAppLock, writeAppLock, type AppLockSettings } from "@/lib/passkey-client";
import { unwrapAction } from "@/lib/errors";
import Wordmark from "@/components/Wordmark";

const UNLOCKED = "ft_unlocked";
const HIDDEN_AT = "ft_hidden_at";

/**
 * The app lock (Account > Login and security). When it is on for this device, opening the app, or coming back to it after the chosen
 * time away, shows a lock screen until the phone confirms the person with its own face, fingerprint, PIN or pattern.
 * The proof is checked by our server (a passkey signature), not just by this page. The lock is a privacy screen on top of an
 * already signed-in app; "Use password instead" signs out.
 */
export default function AppLock() {
  const [settings, setSettings] = useState<AppLockSettings | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const tried = useRef(false);

  // Read the setting, and lock straight away when this is a fresh open of the app (nothing unlocked yet in this session).
  useEffect(() => {
    const apply = () => {
      const s = readAppLock();
      setSettings(s);
      if (!s) return setLocked(false);
      let fresh = true;
      try {
        fresh = !sessionStorage.getItem(UNLOCKED);
      } catch {
        /* no session storage: lock every time to be safe */
      }
      if (fresh) setLocked(true);
    };
    apply();
    window.addEventListener("ft-applock-changed", apply);
    return () => window.removeEventListener("ft-applock-changed", apply);
  }, []);

  // Coming back from the background after the chosen time locks it again.
  useEffect(() => {
    if (!settings) return;
    const onVisibility = () => {
      try {
        if (document.visibilityState === "hidden") {
          sessionStorage.setItem(HIDDEN_AT, String(Date.now()));
          return;
        }
        const at = Number(sessionStorage.getItem(HIDDEN_AT) ?? 0);
        if (at && Date.now() - at >= settings.delayMin * 60_000) {
          tried.current = false;
          setLocked(true);
        }
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [settings]);

  // Nothing behind the lock screen can be scrolled or tapped.
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);

  const unlock = useCallback(async () => {
    if (!settings || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const begin = (await unwrapAction(beginAppUnlock)()) as { challengeId: string; options: Record<string, unknown> };
      const { credentialId, proof } = await getPasskeyAssertion(begin.options);
      await unwrapAction(finishAppUnlock)(begin.challengeId, credentialId, proof);
      try {
        sessionStorage.setItem(UNLOCKED, "1");
        sessionStorage.removeItem(HIDDEN_AT);
      } catch {
        /* ignore */
      }
      setLocked(false);
    } catch (e) {
      const text = e instanceof Error ? e.message : "";
      if (/logged in|no passkey|no longer saved|not saved|does not belong/i.test(text)) {
        // Signed out, or the passkey was removed: there is nothing to lock any more.
        writeAppLock(null);
        setLocked(false);
      } else if (!passkeyCancelled(e)) {
        setMessage(passkeyErrorText(e));
      }
    } finally {
      setBusy(false);
    }
  }, [settings, busy]);

  // Ask once by itself when the lock appears (some phones only allow it after a tap; the button is there for that).
  useEffect(() => {
    if (locked && settings && !tried.current) {
      tried.current = true;
      void unlock();
    }
  }, [locked, settings, unlock]);

  if (!locked || !settings) return null;
  return (
    <div className="fixed inset-0 z-[99000] flex flex-col items-center justify-center bg-white px-6 text-center" role="dialog" aria-modal="true" aria-label="FasTrack is locked">
      <Wordmark height={28} />
      <span className="mt-8 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 ring-8 ring-brand-50/60">
        <svg viewBox="0 0 24 24" className="h-9 w-9 text-brand-700" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2.5" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          <circle cx="12" cy="15.5" r="1.2" fill="currentColor" />
        </svg>
      </span>
      <h1 className="mt-5 text-xl font-extrabold tracking-tight text-neutral-900">FasTrack is locked</h1>
      <p className="mt-1.5 max-w-xs text-sm text-neutral-500">Unlock with your face, fingerprint, or your phone&apos;s PIN or pattern.</p>
      {message && <p className="mt-3 max-w-xs rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{message}</p>}
      <button type="button" onClick={unlock} disabled={busy} className="mt-6 inline-flex h-12 min-w-[12rem] items-center justify-center rounded-full bg-brand-700 px-8 text-base font-bold text-white shadow-md shadow-brand-700/25 transition hover:bg-brand-800 active:scale-[0.98] disabled:opacity-60">
        {busy ? "Waiting for your phone…" : "Unlock"}
      </button>
      <form action={signOut} className="mt-4">
        <button type="submit" className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline">
          Use password instead
        </button>
      </form>
    </div>
  );
}
