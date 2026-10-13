"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { errorText, unwrapAction } from "@/lib/errors";
import { createApiKey, revokeApiKey } from "@/lib/actions/supplier-integrations";
import { useDialogs } from "@/components/ui/Dialogs";

export interface KeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "never");

export default function ApiKeysCard({ keys }: { keys: KeyRow[] }) {
  const router = useRouter();
  const { confirm: ask } = useDialogs();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create() {
    setError(null);
    start(async () => {
      try {
        const { key } = await unwrapAction(createApiKey)(name);
        setFresh(key);
        setName("");
        router.refresh();
      } catch (e) {
        setError(errorText(e, "Could not create the key."));
      }
    });
  }

  async function revoke(id: string) {
    if (!(await ask({ title: "Revoke this key?", message: "Any system using it stops working straight away.", confirmLabel: "Revoke key", danger: true }))) return;
    start(async () => {
      try {
        await unwrapAction(revokeApiKey)(id);
        router.refresh();
      } catch (e) {
        setError(errorText(e, "Could not revoke the key."));
      }
    });
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold">API keys</h2>
      <p className="mt-1 text-sm text-neutral-500">A key lets your own system list products and update price and stock without logging in. It only ever reaches your own store.</p>

      {fresh && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Copy your key now. It is shown only once.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs text-neutral-800">{fresh}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(fresh).then(() => setCopied(true));
              }}
              className="h-10 rounded-full bg-brand-700 px-5 text-sm font-bold text-white hover:bg-brand-800"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => {
              setFresh(null);
              setCopied(false);
            }}
            className="mt-2 text-xs text-amber-900 underline"
          >
            I have saved it
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Name, for example Warehouse system"
          className="min-h-[2.75rem] flex-1 rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <button onClick={create} disabled={pending || !name.trim()} className="h-11 rounded-full bg-brand-700 px-6 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
          Create key
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-4 divide-y divide-neutral-100">
        {keys.length === 0 && <li className="py-3 text-sm text-neutral-500">No keys yet.</li>}
        {keys.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <div className="min-w-0">
              <p className={`font-medium ${k.revoked_at ? "text-neutral-500 line-through" : "text-neutral-900"}`}>{k.name}</p>
              <p className="text-xs text-neutral-500">
                <code>{k.key_prefix}…</code> · created {fmt(k.created_at)} · last used {fmt(k.last_used_at)}
                {k.revoked_at && ` · revoked ${fmt(k.revoked_at)}`}
              </p>
            </div>
            {!k.revoked_at && (
              <button onClick={() => revoke(k.id)} disabled={pending} className="h-9 rounded-full border border-red-200 px-4 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
