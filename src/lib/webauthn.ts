import "server-only";

/**
 * Checking a passkey ("sign in with Face ID / fingerprint / the phone's PIN or pattern") with the platform's built-in crypto only.
 * The phone signs a one-time challenge with a private key that never leaves it; we hold the matching public key and check the
 * signature. The checks follow the WebAuthn standard: the challenge and address in the signed data must be the ones we expect, the
 * data must be for our own site, and the phone must say the person was verified (face, finger, PIN or pattern).
 */
export const b64uEncode = (bytes: ArrayBuffer | Uint8Array): string => {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const b64uDecode = (text: string): Uint8Array<ArrayBuffer> => {
  const s = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const randomChallenge = () => b64uEncode(crypto.getRandomValues(new Uint8Array(32)));

const sha256 = async (data: Uint8Array<ArrayBuffer>) => new Uint8Array(await crypto.subtle.digest("SHA-256", data));

const equal = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

/** ES256 signatures arrive as DER (SEQUENCE of two INTEGERs); the platform's verify wants the plain 64-byte r||s. */
function derToRaw(der: Uint8Array): Uint8Array<ArrayBuffer> {
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f;
  const readInt = () => {
    if (der[i++] !== 0x02) throw new Error("bad signature");
    const len = der[i++];
    let v = der.slice(i, i + len);
    i += len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(new ArrayBuffer(32));
    out.set(v, 32 - v.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(new ArrayBuffer(64));
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

export const ALG_ES256 = -7;
export const ALG_RS256 = -257;

async function importKey(spki: Uint8Array<ArrayBuffer>, alg: number): Promise<CryptoKey> {
  if (alg === ALG_ES256) return crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  if (alg === ALG_RS256) return crypto.subtle.importKey("spki", spki, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  throw new Error("This kind of passkey is not supported.");
}

export interface ClientData {
  type: string;
  challenge: string;
  origin: string;
}

function parseClientData(b64: string): { data: ClientData; bytes: Uint8Array<ArrayBuffer> } {
  const bytes = b64uDecode(b64);
  const data = JSON.parse(new TextDecoder().decode(bytes)) as ClientData;
  return { data, bytes };
}

/** The authenticator data: 32 bytes of the site name's hash, a flags byte, then a counter. */
function parseAuthData(authData: Uint8Array) {
  if (authData.length < 37) throw new Error("bad authenticator data");
  const flags = authData[32];
  const counter = ((authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36]) >>> 0;
  return { rpIdHash: authData.slice(0, 32), userPresent: !!(flags & 0x01), userVerified: !!(flags & 0x04), counter };
}

async function checkCommon(expect: { type: "webauthn.create" | "webauthn.get"; challenge: string; origin: string; rpId: string }, clientDataB64: string, authData: Uint8Array<ArrayBuffer>) {
  const { data, bytes } = parseClientData(clientDataB64);
  if (data.type !== expect.type) throw new Error("This is not the expected kind of request.");
  if (data.challenge !== expect.challenge) throw new Error("This request has expired. Please try again.");
  if (data.origin !== expect.origin) throw new Error("This request came from a different site.");
  const a = parseAuthData(authData);
  if (!equal(a.rpIdHash, await sha256(new TextEncoder().encode(expect.rpId)))) throw new Error("This passkey belongs to a different site.");
  if (!a.userPresent || !a.userVerified) throw new Error("Your phone did not confirm it is you. Please try again.");
  return { clientDataBytes: bytes, counter: a.counter };
}

export interface RegistrationProof {
  clientDataJSON: string;
  authenticatorData: string;
  publicKey: string;
  publicKeyAlgorithm: number;
}

/** Checks a new passkey's registration; returns what to keep. Throws a plain-language error when anything is off. */
export async function verifyRegistration(expect: { challenge: string; origin: string; rpId: string }, proof: RegistrationProof): Promise<{ publicKey: string; algorithm: number; counter: number }> {
  const authData = b64uDecode(proof.authenticatorData);
  const { counter } = await checkCommon({ ...expect, type: "webauthn.create" }, proof.clientDataJSON, authData);
  if (proof.publicKeyAlgorithm !== ALG_ES256 && proof.publicKeyAlgorithm !== ALG_RS256) throw new Error("This kind of passkey is not supported.");
  await importKey(b64uDecode(proof.publicKey), proof.publicKeyAlgorithm); // must be a real key
  return { publicKey: proof.publicKey, algorithm: proof.publicKeyAlgorithm, counter };
}

export interface AssertionProof {
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
}

/** Checks a sign-in proof against the stored public key; returns the phone's new counter. */
export async function verifyAssertion(expect: { challenge: string; origin: string; rpId: string }, stored: { publicKey: string; algorithm: number; counter: number }, proof: AssertionProof): Promise<number> {
  const authData = b64uDecode(proof.authenticatorData);
  const { clientDataBytes, counter } = await checkCommon({ ...expect, type: "webauthn.get" }, proof.clientDataJSON, authData);
  const signedData = new Uint8Array(new ArrayBuffer(authData.length + 32));
  signedData.set(authData, 0);
  signedData.set(await sha256(clientDataBytes), authData.length);
  const key = await importKey(b64uDecode(stored.publicKey), stored.algorithm);
  const sig = b64uDecode(proof.signature);
  const ok =
    stored.algorithm === ALG_ES256
      ? await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, derToRaw(sig), signedData)
      : await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, sig, signedData);
  if (!ok) throw new Error("The passkey could not be verified.");
  // A counter that goes backwards means a copied passkey. Many phones always send 0, which is fine.
  if ((counter !== 0 || stored.counter !== 0) && counter <= stored.counter) throw new Error("This passkey looks copied, so it was refused.");
  return counter;
}
