"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { openAttachment } from "@/lib/download";
import { nativeBridge } from "@/lib/native-bridge";

const ACCEPT = "image/png,image/jpeg,application/pdf";
const okType = (t: string) => /^image\/(png|jpe?g)$/.test(t) || t === "application/pdf";
const isPdf = (url: string) => /\.pdf$/i.test(url.split("?")[0] ?? url);

/** Turn a base64 payload from the native camera bridge into a File for upload. */
function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mimeType });
}

/** Small PDF tile (PDFs can't render as <img>). */
function PdfTile({ size, onClick }: { size: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex ${size} flex-col items-center justify-center rounded-lg border bg-gray-50 text-[9px] font-semibold text-gray-500`}
    >
      <span className="text-base">📄</span>
      PDF
    </button>
  );
}

/** Optional bill attachments — multiple PNG/JPG/PDF, uploaded to /uploads. */
export function MultiImageUpload({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Only the RN shell exposes a native camera; read after mount (hydration-safe).
  const [nativeShell, setNativeShell] = useState(false);
  useEffect(() => setNativeShell(nativeBridge.isAvailable()), []);

  async function handleCamera() {
    setError(false);
    setBusy(true);
    try {
      const img = await nativeBridge.pickImage("camera").catch(() => null);
      if (img?.base64) {
        const { attachmentUrl } = await api.uploadImage(
          base64ToFile(img.base64, img.mimeType, img.filename),
        );
        onChange([...value, attachmentUrl]);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(false);
    setBusy(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!okType(file.type)) {
          setError(true);
          continue;
        }
        const { attachmentUrl } = await api.uploadImage(file);
        uploaded.push(attachmentUrl);
      }
      if (uploaded.length) onChange([...value, ...uploaded]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />

      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {value.map((url) => (
            <div key={url} className="relative">
              {isPdf(url) ? (
                <PdfTile size="h-16 w-16" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="bill" className="h-16 w-16 rounded-lg border object-cover" />
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((u) => u !== url))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-due text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {nativeShell && (
          <button
            type="button"
            onClick={handleCamera}
            disabled={busy}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-dashed border-gray-300 p-4 text-center disabled:opacity-60"
          >
            <span className="text-xl">📷</span>
            <span className="text-sm font-semibold text-gray-700">Camera</span>
            <span className="text-xs text-gray-400">Snap a bill</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center gap-1 rounded-xl border border-dashed border-gray-300 p-4 text-center ${nativeShell ? "flex-1" : "w-full"}`}
        >
          <span className="text-xl">⬆️</span>
          <span className="text-sm font-semibold text-gray-700">
            {busy ? "Uploading…" : value.length ? "Add more" : nativeShell ? "Gallery / files" : "Click to upload"}
          </span>
          <span className="text-xs text-gray-400">PNG, JPG or PDF · multiple allowed</span>
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-due">Some files weren’t PNG/JPG/PDF or failed to upload.</p>
      )}
    </div>
  );
}

/** Tappable attachment thumbnails — images open in a viewer, PDFs open natively. */
export function AttachmentThumbs({ urls }: { urls: string[] | null | undefined }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!urls || urls.length === 0) return null;
  return (
    <>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {urls.map((url) =>
          isPdf(url) ? (
            <PdfTile
              key={url}
              size="h-10 w-10"
              onClick={() => {
                void openAttachment(url);
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt="bill"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(url);
              }}
              className="h-10 w-10 rounded border object-cover"
            />
          ),
        )}
      </div>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open} alt="bill" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}
