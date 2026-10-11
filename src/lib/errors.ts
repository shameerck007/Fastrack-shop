/**
 * One way to turn "something went wrong" into something a person can act on.
 *
 * Why this exists: in production a server action's thrown error reaches the browser with its message removed (only a
 * `digest` survives). A `UserError` carries its message inside the digest, so the real, readable reason arrives intact.
 * Database and system errors are translated into plain words (and logged with a reference code for support).
 * This file is safe to import from both server and browser code.
 */

const PREFIX = "UE1:";

export interface ErrorInfo {
  /** What the person should read. */
  message: string;
  /** The technical reason, for staff screens and support (never needed to act on the message). */
  detail?: string;
  /** A short code the person can quote to support; the same code is in the server log. */
  ref?: string;
}

/** A short code to quote to support, e.g. "K3F9QX". */
export function makeRef(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** An error whose message is meant to be shown to the person who triggered it. */
export class UserError extends Error {
  digest: string;
  detail?: string;
  ref?: string;
  constructor(message: string, detail?: string, ref?: string) {
    super(message);
    this.name = "UserError";
    this.detail = detail;
    this.ref = ref;
    // The digest is the one field that crosses the server -> browser boundary in production.
    this.digest = PREFIX + encodeURIComponent(JSON.stringify({ m: message.slice(0, 500), d: detail?.slice(0, 400), r: ref })).slice(0, 1800);
  }
}

function decodeDigest(digest: unknown): ErrorInfo | null {
  if (typeof digest !== "string" || !digest.startsWith(PREFIX)) return null;
  try {
    const o = JSON.parse(decodeURIComponent(digest.slice(PREFIX.length))) as { m?: string; d?: string; r?: string };
    if (!o.m) return null;
    return { message: o.m, detail: o.d, ref: o.r };
  } catch {
    return null;
  }
}

interface DbLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

const humanize = (s: string) => s.replace(/_/g, " ").replace(/\b(id)\b/i, "").trim().replace(/^./, (c) => c.toUpperCase());

/** Plain words for the errors the database and its API report. */
export function describeDbError(e: DbLike): ErrorInfo | null {
  const code = e.code ?? "";
  const msg = e.message ?? "";
  const det = e.details ?? "";
  const detail = [code, msg].filter(Boolean).join(": ").slice(0, 300);
  const text = (m: string) => ({ message: m, detail });

  if (code === "23505") {
    const key = /Key \(([^)]+)\)=\(([^)]*)\)/.exec(det);
    if (key) return text(`That ${humanize(key[1].split(",")[0].trim()).toLowerCase()} is already in use ("${key[2]}"). Please choose a different one.`);
    return text("That already exists. Please choose a different value.");
  }
  if (code === "23503") {
    const ref = /is still referenced from table "([^"]+)"/.exec(det);
    if (ref) return text(`This can't be removed because it is still used by ${humanize(ref[1]).toLowerCase()}.`);
    return text("A linked item doesn't exist any more. Please refresh the page and try again.");
  }
  if (code === "23502") {
    const col = /column "([^"]+)"/.exec(msg);
    return text(col ? `${humanize(col[1])} is required.` : "A required field is empty.");
  }
  if (code === "23514") {
    const c = /constraint "([^"]+)"/.exec(msg);
    return text(c ? `A value is outside what is allowed (${humanize(c[1].replace(/_check$/, ""))}). Please check the numbers you entered.` : "A value is outside what is allowed. Please check the numbers you entered.");
  }
  if (code === "22P02") return text("One of the values has the wrong format. Please check what you typed.");
  if (code === "22001") return text("One of the texts is too long. Please shorten it.");
  if (code === "22003") return text("A number is too large or too small.");
  if (code === "22007" || code === "22008") return text("A date or time has the wrong format.");
  if (code === "42501" || /row-level security|permission denied/i.test(msg)) {
    const table = /table "([^"]+)"/.exec(msg);
    return text(`You don't have permission to do this${table ? ` (${humanize(table[1]).toLowerCase()})` : ""}. If you think you should, ask an administrator.`);
  }
  if (code === "PGRST116") return text("We couldn't find that item. It may have been deleted. Please refresh the page.");
  if (code === "57014" || /statement timeout/i.test(msg)) return text("That took too long. Please try again, or narrow your search.");
  if (code === "40001" || code === "40P01") return text("Someone else changed the same thing at the same moment. Please try again.");
  if (code === "42P01" || code === "42703" || code === "42883" || code === "PGRST204" || code === "PGRST205" || code === "PGRST202") {
    return text("This feature is waiting for a system update that hasn't been applied yet. Please tell the administrator.");
  }
  if (/^08/.test(code) || /fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg)) return text("We couldn't reach the database just now. Please try again in a moment.");
  if (/JWT|not authenticated|invalid claim|session/i.test(msg) && !/violates/.test(msg)) return text("Your session has ended. Please log in again.");
  // A message we wrote ourselves inside the database (raise exception ...): safe to show as it is.
  if (code === "P0001" && msg) return { message: msg, detail };
  return null;
}

function isDbLike(e: unknown): e is DbLike {
  return !!e && typeof e === "object" && ("code" in e || "details" in e || "hint" in e) && "message" in e;
}

/** Control-flow signals (redirects, "not found") must pass through untouched. */
function isSignal(e: unknown): boolean {
  const d = e && typeof e === "object" ? (e as { digest?: unknown }).digest : undefined;
  return typeof d === "string" && !d.startsWith(PREFIX);
}

const GENERIC = "Something went wrong on our side. Please try again in a moment.";

/**
 * The readable version of any error: our own messages as written, database errors in plain words, anything unexpected as
 * a calm generic line. Unexpected errors get a reference code and are written to the server log with everything.
 */
export function describeError(err: unknown, fallback?: string): ErrorInfo {
  if (err instanceof UserError) return { message: err.message, detail: err.detail, ref: err.ref };
  const fromDigest = decodeDigest(err && typeof err === "object" ? (err as { digest?: unknown }).digest : undefined);
  if (fromDigest) return fromDigest;
  if (isDbLike(err)) {
    const known = describeDbError(err);
    if (known) return known;
  }
  const ref = makeRef();
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err ?? "");
  if (typeof console !== "undefined") console.error(`[error ${ref}]`, raw, err instanceof Error ? err.stack : "");
  return { message: fallback ?? GENERIC, detail: raw.slice(0, 300), ref };
}

/** Server side: turns whatever was thrown into a `UserError` (redirects and not-found signals pass through). */
export function toUserError(err: unknown, fallback?: string): unknown {
  if (err instanceof UserError || isSignal(err)) return err;
  const info = describeError(err, fallback);
  return new UserError(info.message, info.detail, info.ref);
}

/** Server side: the readable text for a returned `{ error }`. */
export function friendlyMessage(err: unknown, fallback?: string): string {
  const info = describeError(err, fallback);
  return info.ref ? `${info.message} (Reference ${info.ref})` : info.message;
}

const REDACTED = /An error occurred in the Server Components render|specific message is omitted in production/i;
const OFFLINE = /failed to fetch|networkerror|load failed|network request failed|the network connection was lost|fetch failed/i;

/** Browser side: everything known about a caught error, in plain words. */
export function errorInfo(err: unknown, fallback?: string): ErrorInfo {
  if (err instanceof UserError) return { message: err.message, detail: err.detail, ref: err.ref };
  const d = decodeDigest(err && typeof err === "object" ? (err as { digest?: unknown }).digest : undefined);
  if (d) return d;
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (OFFLINE.test(raw) || (typeof navigator !== "undefined" && navigator.onLine === false)) {
    return { message: "We can't reach the server. Please check your internet connection and try again.", detail: raw.slice(0, 200) };
  }
  if (REDACTED.test(raw)) {
    const dig = err && typeof err === "object" && typeof (err as { digest?: unknown }).digest === "string" ? String((err as { digest: string }).digest) : undefined;
    return { message: fallback ?? GENERIC, ref: dig ? `E${dig.slice(-6)}` : undefined, detail: "The server reported an error." };
  }
  if (isDbLike(err)) {
    const known = describeDbError(err);
    if (known) return known;
  }
  return { message: raw || fallback || GENERIC, detail: raw ? undefined : undefined };
}

/** Browser side: one line for a message under a form or in a toast. */
export function errorText(err: unknown, fallback?: string): string {
  const i = errorInfo(err, fallback);
  return i.ref ? `${i.message} (Reference ${i.ref})` : i.message;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Server actions: errors travel as a returned value, because a thrown error loses its message on the way to the browser. */

/** What a server action returns when it failed. Callers never see it: `unwrapAction` turns it back into a thrown `UserError`. */
export interface ActionFailure {
  __actionError: true;
  message: string;
  detail?: string;
  ref?: string;
}

/** Server side: the catch of every server action. Redirects pass through; everything else becomes a readable failure value. */
export function failure(err: unknown): ActionFailure {
  if (err instanceof UserError) return { __actionError: true, message: err.message, detail: err.detail, ref: err.ref };
  if (isSignal(err)) throw err;
  const info = describeError(err);
  return { __actionError: true, message: info.message, detail: info.detail, ref: info.ref };
}

function isFailure(v: unknown): v is ActionFailure {
  return !!v && typeof v === "object" && (v as { __actionError?: unknown }).__actionError === true;
}

/**
 * Wraps a server action at the place it is used: when the action reports a failure, this throws a `UserError` carrying the
 * real message, so ordinary try/catch code (and `errorText`) shows exactly what went wrong.
 */
export function unwrapAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    const result = await fn(...args);
    if (isFailure(result)) throw new UserError(result.message, result.detail, result.ref);
    return result;
  };
}
