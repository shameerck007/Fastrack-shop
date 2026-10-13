"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { errorText, unwrapAction } from "@/lib/errors";
import { regenerateWebhookSecret, saveWebhook, sendTestWebhook } from "@/lib/actions/supplier-integrations";

export interface WebhookSettings {
  url: string;
  secret: string;
  enabled: boolean;
}

export interface WebhookEventRow {
  id: string;
  event: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  last_status: number | null;
  last_error: string | null;
  created_at: string;
  order_number: string | null;
}

const fmt = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS_STYLE = { delivered: "bg-emerald-50 text-emerald-700", pending: "bg-amber-50 text-amber-700", failed: "bg-red-50 text-red-700" } as const;

export default function WebhookCard({ webhook, events }: { webhook: WebhookSettings | null; events: WebhookEventRow[] }) {
  const router = useRouter();
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [enabled, setEnabled] = useState(webhook?.enabled ?? true);
  const [reveal, setReveal] = useState(false);
  const [secret, setSecret] = useState(webhook?.secret ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<void>) {
    setMsg(null);
    start(async () => {
      try {
        await fn();
      } catch (e) {
        setMsg({ ok: false, text: errorText(e, "Something went wrong.") });
      }
    });
  }

  const save = () =>
    run(async () => {
      const r = await unwrapAction(saveWebhook)(url, enabled);
      setSecret(r.secret);
      setMsg({ ok: true, text: "Saved." });
      router.refresh();
    });

  const rotate = () => {
    if (!confirm("Make a new secret? Your system must be updated with it, or it will reject FasTrack's messages.")) return;
    run(async () => {
      const r = await unwrapAction(regenerateWebhookSecret)();
      setSecret(r.secret);
      setReveal(true);
      setMsg({ ok: true, text: "New secret made. Copy it into your system." });
    });
  };

  const test = () =>
    run(async () => {
      const r = await unwrapAction(sendTestWebhook)();
      setMsg(r.ok ? { ok: true, text: `Your system answered ${r.status}. The test worked.` } : { ok: false, text: r.error ?? "The test failed." });
    });

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold">Order webhook</h2>
      <p className="mt-1 text-sm text-neutral-500">
        FasTrack sends your system a message the moment an order with your items is placed, picked up, delivered or cancelled, or a customer asks to return an item. No need to keep checking.
      </p>

      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-800">Your address (https)</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-system.com/fastrack"
          inputMode="url"
          className="min-h-[2.75rem] rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-blue-700" />
        Send messages
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={save} disabled={pending || !url.trim()} className="h-11 rounded-full bg-blue-700 px-6 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
          Save
        </button>
        <button onClick={test} disabled={pending || !webhook} className="h-11 rounded-full border border-neutral-300 px-5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
          Send a test message
        </button>
      </div>
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}

      {webhook && (
        <div className="mt-5 rounded-xl bg-neutral-50 p-4">
          <p className="text-sm font-semibold text-neutral-900">Signing secret</p>
          <p className="mt-0.5 text-xs text-neutral-500">Your system uses this to check a message really came from FasTrack.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs text-neutral-800 ring-1 ring-neutral-200">{reveal ? secret : "whsec_••••••••••••••••••••"}</code>
            <button onClick={() => setReveal((v) => !v)} className="h-9 rounded-full border border-neutral-300 px-4 text-xs font-semibold text-neutral-700 hover:bg-white">
              {reveal ? "Hide" : "Show"}
            </button>
            <button onClick={rotate} disabled={pending} className="h-9 rounded-full border border-red-200 px-4 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Make a new secret
            </button>
          </div>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold">Recent messages</h3>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">Nothing sent yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-100">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-mono text-xs text-neutral-900">
                  {e.event}
                  {e.order_number && <span className="text-neutral-500"> · #{e.order_number}</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  {fmt(e.created_at)} · {e.attempts} {e.attempts === 1 ? "try" : "tries"}
                  {e.status !== "delivered" && e.last_error ? ` · ${e.last_error}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[e.status]}`}>
                {e.status === "pending" && e.attempts > 0 ? "retrying" : e.status}
                {e.last_status ? ` ${e.last_status}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
