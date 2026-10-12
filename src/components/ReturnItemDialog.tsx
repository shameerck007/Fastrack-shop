"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import ImageUploader from "@/components/ImageUploader";
import { Field, inputClass } from "@/components/ui/Form";
import { requestReturn } from "@/lib/actions/returns";
import { unwrapAction } from "@/lib/errors";
import { RETURN_REASONS } from "@/lib/returns";

/** Return one item of a delivered order: how many, why, and a photo if something is wrong with it. Nothing is raised against the rest of the order. */
export default function ReturnItemDialog({ orderId, itemId, name, variant, maxQty, closesAt }: { orderId: string; itemId: string; name: string; variant: string; maxQty: number; closesAt: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [photos, setPhotos] = useState<(string | null)[]>([null]);
  const chosen = RETURN_REASONS.find((r) => r.id === reason);
  const photoList = photos.filter((p): p is string => !!p);

  async function save(): Promise<string | void> {
    if (!reason) return "Choose why you are returning this item.";
    if (chosen?.hint === "A photo is needed" && photoList.length === 0) return "Please add a photo so we can see the problem.";
    await unwrapAction(requestReturn)(orderId, itemId, qty, reason, details, photoList);
    router.refresh();
  }

  return (
    <>
      <span className="text-xs text-neutral-500">
        {closesAt && <>Return window closes {new Date(closesAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · </>}
        <button type="button" onClick={() => setOpen(true)} className="text-blue-700 hover:text-orange-700 hover:underline">
          Return item
        </button>
      </span>
      {open && (
        <FormDialog icon="↩️" title="Return this item" subtitle={`${name}${variant ? ` · ${variant}` : ""}`} saveLabel="Submit return" onClose={() => setOpen(false)} onSave={save}>
          {maxQty > 1 && (
            <DialogSection cols={1} title="How many?" hint={`You can return up to ${maxQty}.`}>
              <div className="inline-flex items-center rounded-full border border-neutral-300">
                <button type="button" className="px-4 py-1.5 text-lg disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <span className="w-10 text-center text-sm font-bold">{qty}</span>
                <button type="button" className="px-4 py-1.5 text-lg disabled:opacity-40" disabled={qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>
                  +
                </button>
              </div>
            </DialogSection>
          )}
          <DialogSection cols={1} title="Why are you returning it?">
            <div className="grid gap-2">
              {RETURN_REASONS.map((r) => (
                <label key={r.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${reason === r.id ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-neutral-200 hover:border-neutral-300"}`}>
                  <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} className="h-4 w-4 accent-blue-700" />
                  <span className="flex-1 font-medium text-neutral-900">{r.label}</span>
                  {r.defect && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Fast approval</span>}
                </label>
              ))}
            </div>
          </DialogSection>
          <DialogSection cols={1} title="Add photos" hint={chosen?.hint === "A photo is needed" ? "A photo is needed so we can see the problem. Up to 3." : "Optional. Up to 3."}>
            <div className="flex flex-wrap gap-3">
              {photos.map((p, i) => (
                <ImageUploader key={i} value={p} alt="Return photo" emoji="📷" onChange={(url) => setPhotos((list) => list.map((x, j) => (j === i ? url : x)))} />
              ))}
              {photos.length < 3 && photos.every(Boolean) && (
                <button type="button" onClick={() => setPhotos((l) => [...l, null])} className="h-20 rounded-lg border border-dashed border-neutral-300 px-4 text-xs font-semibold text-neutral-500 hover:bg-neutral-50">
                  + Another photo
                </button>
              )}
            </div>
          </DialogSection>
          <DialogSection cols={1}>
            <Field label="Anything else we should know?">
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={500} className={inputClass} placeholder="Optional" />
            </Field>
            <p className="text-xs text-neutral-500">
              {closesAt ? `You can return this item until ${new Date(closesAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. ` : ""}
              Once approved, a rider collects the item and you are refunded when it is collected. Show the rider the return code on your order page.
            </p>
          </DialogSection>
        </FormDialog>
      )}
    </>
  );
}
