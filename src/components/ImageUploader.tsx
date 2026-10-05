"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — matches the product-images bucket's own limit (defense in depth)
const MAX_DIMENSION = 1600; // px, longest side — plenty for product photos, keeps pages fast
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Large photos straight from a phone camera (10-20+ MB, 4000px+) are common
// and would otherwise slow the page down for every shopper who loads it —
// resize/re-encode client-side before upload rather than just rejecting them.
async function prepareImage(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file; // don't re-encode animated GIFs

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_BYTES) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  // Fall back to the last (smallest) attempt even if still over, so the
  // upload's own size check gives a clear final answer rather than looping.
  return (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.5))) ?? file;
}

export default function ImageUploader({
  value,
  onChange,
  alt = "Product",
  emoji = "📦",
  wide = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  alt?: string;
  emoji?: string;
  /** Landscape preview, for cover images. */
  wide?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a JPG, PNG, WEBP or GIF image.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("That image is too large (over 25 MB) — please choose a smaller file.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const prepared = await prepareImage(file);
      if (prepared.size > MAX_BYTES) {
        setError("Image is still too large after compression — please choose a smaller photo.");
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in.");

      const ext = prepared.type === "image/gif" ? "gif" : "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, prepared, { cacheControl: "3600", upsert: false, contentType: prepared.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50 ${wide ? "w-36" : "w-20"}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl">{emoji}</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : value ? "Change photo" : "Add photo"}
        </button>
        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-neutral-500 hover:text-red-600"
          >
            Remove
          </button>
        )}
        {!error && <p className="text-[11px] text-neutral-400">JPG, PNG, WEBP or GIF — large photos are resized automatically</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
