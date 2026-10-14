"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UserError, failure } from "@/lib/errors";
import { b64uEncode, randomChallenge, verifyAssertion, verifyRegistration, type AssertionProof, type RegistrationProof } from "@/lib/webauthn";

/**
 * Passkeys: sign in, and unlock the app, with the phone's own face, fingerprint, PIN or pattern.
 * Each action here is one half of a two-step exchange: "begin" hands the phone a one-time challenge, "finish" checks the phone's
 * signed answer (see src/lib/webauthn.ts). The browser only ever receives public information.
 */
export interface PasskeyInfo {
  id: string;
  credentialId: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const RP_NAME = "FasTrack";

async function site() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { rpId: host.split(":")[0], origin: `${proto}://${host}` };
}

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");
  return { supabase, user };
}

/** Hands out a one-time challenge and remembers it for five minutes. */
async function newChallenge(purpose: "register" | "login" | "unlock", userId: string | null) {
  const db = createServiceClient();
  await db.from("passkey_challenges").delete().lt("expires_at", new Date().toISOString());
  const challenge = randomChallenge();
  const { data, error } = await db.from("passkey_challenges").insert({ challenge, purpose, user_id: userId }).select("id").single();
  if (error || !data) throw error ?? new Error("Could not start.");
  return { id: (data as { id: string }).id, challenge };
}

/** Uses a challenge exactly once: it is deleted as it is read, so the same answer cannot be replayed. */
async function takeChallenge(id: string, purpose: "register" | "login" | "unlock") {
  const db = createServiceClient();
  const { data } = await db.from("passkey_challenges").delete().eq("id", id).eq("purpose", purpose).gt("expires_at", new Date().toISOString()).select("challenge, user_id").maybeSingle();
  if (!data) throw new UserError("This request has expired. Please try again.");
  return data as { challenge: string; user_id: string | null };
}

// ---- add this phone ------------------------------------------------------------------------------------------------

export async function beginPasskeyRegistration() {
  try {
    const { user } = await currentUser();
    const { rpId } = await site();
    const db = createServiceClient();
    const { data: existing } = await db.from("user_passkeys").select("credential_id").eq("user_id", user.id);
    const c = await newChallenge("register", user.id);
    return {
      challengeId: c.id,
      options: {
        challenge: c.challenge,
        rp: { name: RP_NAME, id: rpId },
        user: { id: b64uEncode(new TextEncoder().encode(user.id)), name: user.email ?? user.phone ?? "FasTrack account", displayName: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "FasTrack account" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        // The phone itself (face, fingerprint, PIN, pattern), not a separate security key.
        authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", requireResidentKey: true, userVerification: "required" },
        excludeCredentials: ((existing ?? []) as { credential_id: string }[]).map((e) => ({ type: "public-key", id: e.credential_id })),
        timeout: 60000,
        attestation: "none",
      },
    };
  } catch (e) {
    return failure(e) as never;
  }
}

export async function finishPasskeyRegistration(challengeId: string, credentialId: string, proof: RegistrationProof & { transports?: string[] }, deviceName: string) {
  try {
    const { user } = await currentUser();
    const ch = await takeChallenge(challengeId, "register");
    if (ch.user_id !== user.id) throw new UserError("This request does not belong to you.");
    const { rpId, origin } = await site();
    const v = await verifyRegistration({ challenge: ch.challenge, origin, rpId }, proof);
    const db = createServiceClient();
    const { error } = await db.from("user_passkeys").insert({
      user_id: user.id,
      credential_id: credentialId,
      public_key: v.publicKey,
      algorithm: v.algorithm,
      counter: v.counter,
      transports: (proof.transports ?? []).slice(0, 6),
      device_name: deviceName.trim().slice(0, 60) || "This device",
    });
    if (error) throw new UserError(error.code === "23505" ? "This device is already added." : "Could not save the passkey.");
    revalidatePath("/account/security");
    return { ok: true, credentialId };
  } catch (e) {
    return failure(e) as never;
  }
}

// ---- sign in with the phone ----------------------------------------------------------------------------------------

export async function beginPasskeyLogin() {
  try {
    const { rpId } = await site();
    const c = await newChallenge("login", null);
    // No list of allowed passkeys: the phone offers the ones it has for this site.
    return { challengeId: c.id, options: { challenge: c.challenge, rpId, userVerification: "required", timeout: 60000 } };
  } catch (e) {
    return failure(e) as never;
  }
}

interface StoredPasskey {
  id: string;
  user_id: string;
  public_key: string;
  algorithm: number;
  counter: number;
}

async function loadPasskey(credentialId: string): Promise<StoredPasskey> {
  const db = createServiceClient();
  const { data } = await db.from("user_passkeys").select("id, user_id, public_key, algorithm, counter").eq("credential_id", credentialId).maybeSingle();
  if (!data) throw new UserError("This passkey is no longer saved. Please sign in with your password.");
  return data as StoredPasskey;
}

export async function finishPasskeyLogin(challengeId: string, credentialId: string, proof: AssertionProof) {
  try {
    const ch = await takeChallenge(challengeId, "login");
    const stored = await loadPasskey(credentialId);
    const { rpId, origin } = await site();
    const counter = await verifyAssertion({ challenge: ch.challenge, origin, rpId }, { publicKey: stored.public_key, algorithm: stored.algorithm, counter: Number(stored.counter) }, proof);
    const db = createServiceClient();
    await db.from("user_passkeys").update({ counter, last_used_at: new Date().toISOString() }).eq("id", stored.id);

    // The phone proved it is them: open a session for that account (a one-time sign-in link used right here, never sent by email).
    const { data: u } = await db.auth.admin.getUserById(stored.user_id);
    const email = u?.user?.email;
    if (!email) throw new UserError("This account cannot sign in with a passkey. Please use your password.");
    const { data: link, error: linkError } = await db.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) throw new UserError("Could not sign you in. Please use your password.");
    const supabase = await createClient();
    const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (otpError) throw new UserError("Could not sign you in. Please use your password.");
    return { ok: true };
  } catch (e) {
    return failure(e) as never;
  }
}

// ---- app lock ------------------------------------------------------------------------------------------------------

/** The signed-in shopper's passkeys, for the lock screen: it asks the phone to confirm with this device's own passkey. */
export async function beginAppUnlock(credentialId: string) {
  try {
    const { user } = await currentUser();
    const { rpId } = await site();
    const db = createServiceClient();
    const { data } = await db.from("user_passkeys").select("credential_id").eq("user_id", user.id).eq("credential_id", credentialId).maybeSingle();
    if (!data) throw new UserError("No passkey on this device.");
    const c = await newChallenge("unlock", user.id);
    return { challengeId: c.id, options: { challenge: c.challenge, rpId, userVerification: "required", allowCredentials: [{ type: "public-key", id: credentialId }], timeout: 60000 } };
  } catch (e) {
    return failure(e) as never;
  }
}

export async function finishAppUnlock(challengeId: string, credentialId: string, proof: AssertionProof) {
  try {
    const { user } = await currentUser();
    const ch = await takeChallenge(challengeId, "unlock");
    const stored = await loadPasskey(credentialId);
    if (stored.user_id !== user.id || ch.user_id !== user.id) throw new UserError("This passkey does not belong to this account.");
    const { rpId, origin } = await site();
    const counter = await verifyAssertion({ challenge: ch.challenge, origin, rpId }, { publicKey: stored.public_key, algorithm: stored.algorithm, counter: Number(stored.counter) }, proof);
    await createServiceClient().from("user_passkeys").update({ counter, last_used_at: new Date().toISOString() }).eq("id", stored.id);
    return { ok: true };
  } catch (e) {
    return failure(e) as never;
  }
}

// ---- manage ----------------------------------------------------------------------------------------------------------

export async function listPasskeys(): Promise<PasskeyInfo[]> {
  try {
    const { supabase } = await currentUser();
    const { data } = await supabase.from("user_passkeys" as never).select("id, credential_id, device_name, created_at, last_used_at").order("created_at");
    return ((data ?? []) as { id: string; credential_id: string; device_name: string; created_at: string; last_used_at: string | null }[]).map((p) => ({ id: p.id, credentialId: p.credential_id, deviceName: p.device_name, createdAt: p.created_at, lastUsedAt: p.last_used_at }));
  } catch (e) {
    return failure(e) as never;
  }
}

export async function removePasskey(id: string) {
  try {
    const { supabase } = await currentUser();
    const { error } = await supabase.from("user_passkeys" as never).delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/account/security");
    return { ok: true };
  } catch (e) {
    return failure(e) as never;
  }
}
