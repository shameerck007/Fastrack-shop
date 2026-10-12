"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { Field, inputClass } from "@/components/ui/Form";
import { receiveReturn } from "@/lib/actions/returns";
import { unwrapAction } from "@/lib/errors";

/** Check a returned item in: good condition goes back into stock, damaged does not. */
export default function ReceiveReturnDialog({ returnId, label, onClose }: { returnId: string; label: string; onClose: () => void }) {
  const router = useRouter();
  const [condition, setCondition] = useState<"good" | "damaged">("good");
  const [note, setNote] = useState("");
  async function save(): Promise<string | void> {
    await unwrapAction(receiveReturn)(returnId, condition, note);
    router.refresh();
  }
  const opts: ["good" | "damaged", string, string][] = [
    ["good", "Good condition", "The units go back into stock."],
    ["damaged", "Damaged", "Nothing is added to stock."],
  ];
  return (
    <FormDialog icon="📥" title="Receive this return" subtitle={label} saveLabel="Confirm received" onClose={onClose} onSave={save}>
      <DialogSection cols={1}>
        <div className="grid gap-2">
          {opts.map(([id, title, hint]) => (
            <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${condition === id ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-neutral-200"}`}>
              <input type="radio" name="condition" checked={condition === id} onChange={() => setCondition(id)} className="mt-0.5 h-4 w-4 accent-blue-700" />
              <span>
                <span className="block font-bold text-neutral-900">{title}</span>
                <span className="block text-xs text-neutral-500">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </DialogSection>
      <DialogSection cols={1}>
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </Field>
      </DialogSection>
    </FormDialog>
  );
}
