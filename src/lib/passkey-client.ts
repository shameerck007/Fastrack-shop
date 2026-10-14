/**
 * The browser's side of passkeys: asks the phone to confirm with its face, fingerprint, PIN or pattern, and turns the answer into
 * plain text for our server. Nothing secret is handled here: the phone keeps its private key to itself.
 */
type Json = Record<string, unknown>;

const enc = (bytes: ArrayBuffer | Uint8Array) => {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const dec = (text: string): ArrayBuffer => {
  const s = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

/** True on a phone or computer that can confirm the person with its own lock (face, fingerprint, PIN, pattern). */
export async function passkeysAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** A friendly name for this device, shown in the list of passkeys. */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android phone" : /Windows/.test(ua) ? "Windows computer" : /Mac/.test(ua) ? "Mac" : "This device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "";
  return browser ? `${os} (${browser})` : os;
}

const cancelled = (e: unknown) => e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError");

/** Turns a phone's refusal into a plain sentence. Cancelling the prompt is not an error worth shouting about. */
export function passkeyErrorText(e: unknown): string {
  if (cancelled(e)) return "Cancelled. Nothing was changed.";
  if (e instanceof DOMException && e.name === "InvalidStateError") return "This device is already added.";
  if (e instanceof DOMException && e.name === "SecurityError") return "Passkeys are not available on this address.";
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}
export const passkeyCancelled = cancelled;

export async function createPasskey(options: Json) {
  const o = options as { challenge: string; user: { id: string; name: string; displayName: string }; excludeCredentials?: { type: string; id: string }[] } & Json;
  const cred = (await navigator.credentials.create({
    publicKey: {
      ...(o as unknown as PublicKeyCredentialCreationOptions),
      challenge: dec(o.challenge),
      user: { ...o.user, id: dec(o.user.id) },
      excludeCredentials: (o.excludeCredentials ?? []).map((c) => ({ type: "public-key" as const, id: dec(c.id) })),
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Cancelled.");
  const r = cred.response as AuthenticatorAttestationResponse;
  const pk = r.getPublicKey?.();
  const authData = r.getAuthenticatorData?.();
  if (!pk || !authData) throw new Error("This browser is too old for passkeys. Please update it.");
  return {
    credentialId: enc(cred.rawId),
    proof: {
      clientDataJSON: enc(r.clientDataJSON),
      authenticatorData: enc(authData),
      publicKey: enc(pk),
      publicKeyAlgorithm: r.getPublicKeyAlgorithm?.() ?? -7,
      transports: r.getTransports?.() ?? [],
    },
  };
}

export async function getPasskeyAssertion(options: Json) {
  const o = options as { challenge: string; allowCredentials?: { type: string; id: string }[] } & Json;
  const cred = (await navigator.credentials.get({
    publicKey: {
      ...(o as unknown as PublicKeyCredentialRequestOptions),
      challenge: dec(o.challenge),
      allowCredentials: o.allowCredentials?.map((c) => ({ type: "public-key" as const, id: dec(c.id) })),
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Cancelled.");
  const r = cred.response as AuthenticatorAssertionResponse;
  return {
    credentialId: enc(cred.rawId),
    proof: { clientDataJSON: enc(r.clientDataJSON), authenticatorData: enc(r.authenticatorData), signature: enc(r.signature) },
  };
}

// ---- app lock settings, kept on this device only (the passkey is per device too) ------------------------------------------

export interface AppLockSettings {
  enabled: boolean;
  /** Minutes in the background before the lock comes back; 0 = every time the app is opened or returned to. */
  delayMin: number;
  credentialId: string;
}
const KEY = "ft_applock";
export function readAppLock(): AppLockSettings | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as AppLockSettings | null;
    return v && v.enabled && v.credentialId ? v : null;
  } catch {
    return null;
  }
}
export function readAppLockRaw(): AppLockSettings | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as AppLockSettings | null;
  } catch {
    return null;
  }
}
export function writeAppLock(v: AppLockSettings | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("ft-applock-changed"));
  } catch {
    /* private mode: the lock simply cannot be remembered */
  }
}
