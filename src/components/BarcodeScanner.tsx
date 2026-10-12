"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { inputClass, primaryButton } from "@/components/ui/Form";

export interface ScanResult {
  ok: boolean;
  /** Shown under the camera: why a code was refused, or what was accepted. */
  message?: string;
  /** Close the scanner (single-scan flows). Leave unset to keep scanning (packing). */
  done?: boolean;
}

// The browser's built-in detector (Chrome and Edge on Android and desktop). Not in every browser, so typing or a hardware scanner is always available too.
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts?: { formats?: string[] }) => Detector;

/** Camera scanner for QR codes and product barcodes, with a typed-code box for hardware scanners and phones without camera scanning. */
export default function BarcodeScanner({ title, hint, onScan, onClose }: { title: string; hint?: string; onScan: (code: string) => Promise<ScanResult>; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busyRef = useRef(false);
  // The latest callbacks, so the camera is not restarted every time the caller re-renders.
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  });
  const [feedback, setFeedback] = useState<ScanResult | null>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "unsupported" | "denied">("starting");
  const [typed, setTyped] = useState("");

  const handle = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || busyRef.current) return;
      const now = Date.now();
      if (lastRef.current.code === code && now - lastRef.current.at < 2500) return;
      lastRef.current = { code, at: now };
      busyRef.current = true;
      try {
        const r = await onScanRef.current(code);
        setFeedback(r);
        if (r.done) onCloseRef.current();
      } catch (e) {
        setFeedback({ ok: false, message: e instanceof Error ? e.message : "Could not check that code." });
      } finally {
        busyRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => !stopped && setCamera("unsupported"));
      return;
    }
    const detector = new Ctor({ formats: ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = s;
        await v.play().catch(() => {});
        setCamera("on");
        timer = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const found = await detector.detect(videoRef.current);
            if (found[0]?.rawValue) void handle(found[0].rawValue);
          } catch {
            // a frame that cannot be read is skipped
          }
        }, 300);
      })
      .catch(() => !stopped && setCamera("denied"));
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [handle]);

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        {hint && <p className="text-sm text-neutral-600">{hint}</p>}
        {camera !== "unsupported" && camera !== "denied" ? (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" />
            <div aria-hidden className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/80" />
            {camera === "starting" && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Starting the camera…</p>}
          </div>
        ) : (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {camera === "denied" ? "The camera is blocked. Allow camera access for this site, or type the code below." : "This browser cannot scan with the camera. Type the code below, or use a hardware scanner."}
          </p>
        )}
        {feedback?.message && (
          <p role="status" className={`rounded-xl p-3 text-sm font-semibold ${feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
            {feedback.ok ? "✓ " : "✕ "}
            {feedback.message}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const c = typed;
            setTyped("");
            void handle(c);
          }}
          className="flex gap-2"
        >
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type or scan a code" autoComplete="off" className={`${inputClass} flex-1`} />
          <button type="submit" className={primaryButton}>
            Check
          </button>
        </form>
      </div>
    </Modal>
  );
}
