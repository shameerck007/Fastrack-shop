"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { Field, primaryButton, secondaryButton, textareaClass } from "@/components/ui/Form";

/**
 * The app's own versions of the browser's confirm() and prompt() boxes ("localhost says…"), which look out of place and cannot be styled.
 * `const { confirm, prompt } = useDialogs()`, then `if (!(await confirm({ ... }))) return;` or `const reason = await prompt({ ... })` (null when cancelled).
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Red confirm button, for deleting or revoking. */
  danger?: boolean;
  icon?: string;
}
export interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** When true (default) an empty answer cannot be submitted. */
  required?: boolean;
  danger?: boolean;
  icon?: string;
}

type Pending =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };

interface Ctx {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
}

const DialogCtx = createContext<Ctx>({
  // Outside the provider (never in the real app) fall back to the browser's own boxes rather than silently doing nothing.
  confirm: async (o) => window.confirm(o.message ?? o.title),
  prompt: async (o) => window.prompt(o.message ?? o.title),
});

export function useDialogs() {
  return useContext(DialogCtx);
}

export default function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const queue = useRef<Pending[]>([]);

  const show = useCallback((p: Pending) => {
    setPending((cur) => {
      if (cur) {
        queue.current.push(p);
        return cur;
      }
      return p;
    });
  }, []);

  const ctx = useMemo<Ctx>(
    () => ({
      confirm: (opts) => new Promise<boolean>((resolve) => show({ kind: "confirm", opts, resolve })),
      prompt: (opts) => new Promise<string | null>((resolve) => show({ kind: "prompt", opts, resolve })),
    }),
    [show],
  );

  function close() {
    setPending(queue.current.shift() ?? null);
  }

  return (
    <DialogCtx.Provider value={ctx}>
      {children}
      {pending && <Box key={pending.opts.title + pending.kind} pending={pending} onDone={close} />}
    </DialogCtx.Provider>
  );
}

function Box({ pending, onDone }: { pending: Pending; onDone: () => void }) {
  const { opts } = pending;
  const isPrompt = pending.kind === "prompt";
  const required = isPrompt ? (pending.opts.required ?? true) : false;
  const [text, setText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const okBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    (isPrompt ? area.current : okBtn.current)?.focus();
  }, [isPrompt]);

  function cancel() {
    if (pending.kind === "confirm") pending.resolve(false);
    else pending.resolve(null);
    onDone();
  }
  function ok() {
    if (pending.kind === "confirm") pending.resolve(true);
    else {
      if (required && !text.trim()) return;
      pending.resolve(text.trim());
    }
    onDone();
  }

  const danger = opts.danger;
  const icon = opts.icon ?? (danger ? "⚠️" : isPrompt ? "✏️" : "❓");
  const confirmLabel = opts.confirmLabel ?? (isPrompt ? "Submit" : "Confirm");

  return (
    <Modal open onClose={cancel}>
      <form
        className="-m-5 flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          ok();
        }}
      >
        <div className="flex items-start gap-3 px-5 pb-4 pt-5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${danger ? "bg-rose-50 ring-1 ring-rose-200" : "bg-brand-50 ring-1 ring-brand-100"}`}>{icon}</span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-base font-extrabold tracking-tight text-neutral-900">{opts.title}</h2>
            {opts.message && <p className="mt-1 text-sm leading-relaxed text-neutral-600">{opts.message}</p>}
          </div>
        </div>
        {isPrompt && (
          <div className="px-5 pb-4">
            <Field label={pending.opts.label}>
              <textarea
                ref={area}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ok();
                  }
                }}
                placeholder={pending.opts.placeholder}
                rows={3}
                className={textareaClass}
              />
            </Field>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
          <button type="button" onClick={cancel} className={secondaryButton}>
            Cancel
          </button>
          <button
            ref={okBtn}
            type="submit"
            disabled={isPrompt && required && !text.trim()}
            className={danger ? primaryButton.replace("bg-brand-700", "bg-rose-600").replace("hover:bg-brand-800", "hover:bg-rose-700") : primaryButton}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
