"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStoreProfile } from "@/lib/actions/merchant";
import { adminUpdateStoreProfile } from "@/lib/actions/admin-merchants";
import StoreProfileFields, { type StoreProfileValue } from "@/components/merchant/StoreProfileFields";
import type { OpeningHours } from "@/lib/store-hours";

export default function StoreProfileForm({
  initial,
  storeId,
}: {
  /** Set when an admin is editing a shop on its behalf. */
  storeId?: string;
  initial: {
    logoUrl: string | null;
    coverUrl: string | null;
    tagline: string | null;
    hours: OpeningHours;
    acceptingOrders: boolean;
  };
}) {
  const [profile, setProfile] = useState<StoreProfileValue>({
    logoUrl: initial.logoUrl,
    coverUrl: initial.coverUrl,
    tagline: initial.tagline ?? "",
    hours: initial.hours,
  });
  const [accepting, setAccepting] = useState(initial.acceptingOrders);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      try {
        const payload = {
          logoUrl: profile.logoUrl,
          coverUrl: profile.coverUrl,
          tagline: profile.tagline,
          openingHours: profile.hours,
          acceptingOrders: accepting,
        };
        if (storeId) await adminUpdateStoreProfile({ storeId, ...payload });
        else await updateStoreProfile(payload);
        setMessage({ ok: true, text: "Saved." });
        router.refresh();
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not save." });
      }
    });
  }

  return (
    <form onSubmit={save} className={`flex flex-col gap-4 ${storeId ? "" : "mt-6 rounded-xl border border-neutral-200 bg-white p-4"}`}>
      {!storeId && (
        <div>
          <p className="text-sm font-medium">Shop page &amp; opening hours</p>
          <p className="text-xs text-neutral-500">Your logo and hours appear on your shop page and next to your products.</p>
        </div>
      )}

      <label className="flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-sm">
        <input type="checkbox" className="mt-0.5" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} />
        <span>
          <span className="font-medium">Accepting orders</span>
          <span className="block text-xs text-neutral-500">Turn off to pause orders right now (for example when you are too busy). Customers see your shop as closed.</span>
        </span>
      </label>

      <StoreProfileFields value={profile} onChange={setProfile} />

      {message && <p className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-blue-700 px-6 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
