"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { Field, primaryButton, secondaryButton, textareaClass } from "@/components/ui/Form";
import { addCustomerNote, revealCustomerContact, setCustomerBlocked } from "@/lib/actions/admin-customers";

/** Contact details: masked for everyone; the platform super admin can reveal them (each reveal is logged). */
export function ContactCard({ id, phoneMasked, emailMasked, canReveal }: { id: string; phoneMasked: string | null; emailMasked: string | null; canReveal: boolean }) {
  const [full, setFull] = useState<{ phone: string | null; email: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex justify-between gap-4">
        <span className="text-neutral-500">Phone</span>
        <span className="font-mono font-semibold text-neutral-900">{full ? (full.phone ?? "—") : (phoneMasked ?? "—")}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-neutral-500">Email</span>
        <span className="min-w-0 truncate font-mono font-semibold text-neutral-900">{full ? (full.email ?? "—") : (emailMasked ?? "—")}</span>
      </div>
      {canReveal ? (
        full ? (
          <button type="button" onClick={() => setFull(null)} className="self-start text-xs font-bold text-blue-700 hover:underline">
            Hide again
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await revealCustomerContact(id);
                if ("phone" in res) setFull({ phone: res.phone, email: res.email });
                else setError(res.error);
              })
            }
            className="self-start rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-blue-50 disabled:opacity-50"
          >
            {pending ? "Revealing…" : "👁 Reveal contact details"}
          </button>
        )
      ) : (
        <p className="text-xs text-neutral-400">Full contact details can be revealed by the platform super admin only.</p>
      )}
      {full && <p className="text-[11px] text-neutral-400">This reveal has been recorded in the access log.</p>}
      {error && <p className="text-xs font-medium text-blue-900">{error}</p>}
    </div>
  );
}

/** Block or unblock ordering for a customer (a reason is required to block). */
export function BlockButton({ id, blocked, name }: { id: string; blocked: boolean; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(next: boolean) {
    setError(null);
    start(async () => {
      const res = await setCustomerBlocked(id, next, reason);
      if (res.error) setError(res.error);
      else {
        setOpen(false);
        setReason("");
        router.refresh();
      }
    });
  }

  if (blocked) {
    return (
      <button type="button" disabled={pending} onClick={() => submit(false)} className="h-10 rounded-full border border-neutral-300 bg-white px-5 text-sm font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
        {pending ? "Unblocking…" : "Unblock customer"}
      </button>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="h-10 rounded-full border border-red-200 bg-white px-5 text-sm font-bold text-red-700 hover:bg-red-50">
        Block ordering
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={`Block ${name}?`}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-600">A blocked customer can still browse and sign in, but cannot place orders. You can unblock them at any time.</p>
            <Field label="Reason (kept in the log)" required>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={textareaClass} placeholder="e.g. Repeated refused deliveries" />
            </Field>
            {error && <p className="text-sm font-medium text-blue-900">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
                Cancel
              </button>
              <button type="button" disabled={pending || !reason.trim()} onClick={() => submit(true)} className={primaryButton}>
                {pending ? "Blocking…" : "Block ordering"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Internal support note, visible to admins only. */
export function NoteForm({ id }: { id: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await addCustomerNote(id, body);
          if (res.error) setError(res.error);
          else {
            setBody("");
            router.refresh();
          }
        });
      }}
      className="flex flex-col gap-2"
    >
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add an internal note for the support team…" className={textareaClass} />
      {error && <p className="text-xs font-medium text-blue-900">{error}</p>}
      <button type="submit" disabled={pending || !body.trim()} className="self-end rounded-full bg-blue-700 px-5 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50">
        {pending ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}
