// Portable Web Push sender — RFC 8291 (aes128gcm content-encoding) message
// encryption + RFC 8292 (VAPID) request authentication, built entirely on
// Web Crypto (crypto.subtle). No npm dependency: most `web-push`-style
// packages need Node's crypto.createECDH, which isn't reliably available
// under Cloudflare Workers' nodejs_compat, but Web Crypto is native there
// (and in Node 19+, used for local dev) with no compat flag required.

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface WebPushResult {
  ok: boolean;
  status: number;
  /** 404/410 — the push service no longer recognizes this subscription; delete it. */
  expired: boolean;
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const std = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

// VAPID keys are stored/generated in the same raw form the browser's
// PushManager.subscribe() and most Web Push tooling use: the public key as
// an uncompressed EC point (0x04 || X(32) || Y(32), 65 bytes, base64url),
// the private key as the raw 32-byte scalar (base64url). Web Crypto needs
// a JWK to import a signing key, so we reassemble one from those parts.
async function importVapidSigningKey(privateKeyB64url: string, publicKeyB64url: string): Promise<CryptoKey> {
  const pub = b64urlToBytes(publicKeyB64url);
  const d = b64urlToBytes(privateKeyB64url);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: bytesToB64url(d),
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function buildVapidAuthHeader(
  endpoint: string,
  publicKey: string,
  privateKey: string,
  subject: string
): Promise<string> {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const encHeader = bytesToB64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const encPayload = bytesToB64url(new TextEncoder().encode(JSON.stringify({ aud, exp, sub: subject })));
  const signingInput = `${encHeader}.${encPayload}`;
  const key = await importVapidSigningKey(privateKey, publicKey);
  // Web Crypto's ECDSA sign() already returns the raw (r || s) 64-byte
  // signature JWS ES256 expects — no DER-to-raw conversion needed, unlike
  // Node's crypto.sign().
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  return `vapid t=${signingInput}.${bytesToB64url(sig)}, k=${publicKey}`;
}

async function encryptPayload(payload: Uint8Array, p256dhB64url: string, authB64url: string): Promise<Uint8Array> {
  const subscriberPublicKeyBytes = b64urlToBytes(p256dhB64url);
  const authSecret = b64urlToBytes(authB64url);

  const serverKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeyPair.publicKey));

  const subscriberKey = await crypto.subtle.importKey(
    "raw",
    subscriberPublicKeyBytes as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: subscriberKey }, serverKeyPair.privateKey, 256)
  );

  const keyInfo = concatBytes(new TextEncoder().encode("WebPush: info\0"), subscriberPublicKeyBytes, serverPublicRaw);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  // 0x02 padding delimiter = this is the only (last) record, no padding after.
  const paddedPlaintext = concatBytes(payload, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      aesKey,
      paddedPlaintext as BufferSource
    )
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  const header = concatBytes(salt, recordSize, new Uint8Array([serverPublicRaw.length]), serverPublicRaw);
  return concatBytes(header, ciphertext);
}

export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: object,
  vapid: VapidConfig
): Promise<WebPushResult> {
  const body = await encryptPayload(new TextEncoder().encode(JSON.stringify(payload)), sub.p256dh, sub.auth);
  const authHeader = await buildVapidAuthHeader(sub.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Authorization: authHeader,
    },
    body: body as BodyInit,
  });

  return { ok: res.ok, status: res.status, expired: res.status === 404 || res.status === 410 };
}
