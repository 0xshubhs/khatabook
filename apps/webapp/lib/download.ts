import { API_BASE } from "./api";
import { session } from "./auth";
import { nativeBridge } from "./native-bridge";

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Fetch a binary endpoint (with auth) and save it.
 * - RN shell: hand the bytes to the native save/share sheet — an Android WebView
 *   cannot trigger blob downloads, so the `<a download>` path silently fails there.
 * - Browser: blob + `<a download>`, revoking the object URL after a delay (revoking
 *   immediately can cancel the download in some browsers).
 */
export async function downloadFile(
  path: string,
  filename: string,
  mimeType: string,
): Promise<void> {
  const token = session.getAccess();
  const res = await fetch(API_BASE + path, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  if (nativeBridge.isAvailable()) {
    const buf = await res.arrayBuffer();
    await nativeBridge.saveFile({ filename, mimeType, base64: arrayBufferToBase64(buf) });
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Open an already-uploaded attachment (absolute URL). PDFs can't render in the
 * WebView, so in the RN shell we hand them to the native viewer/share sheet. */
export async function openAttachment(url: string): Promise<void> {
  const filename = url.split("/").pop()?.split("?")[0] || "attachment";
  const isPdf = filename.toLowerCase().endsWith(".pdf");
  if (nativeBridge.isAvailable()) {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    await nativeBridge.saveFile({
      filename,
      mimeType: isPdf ? "application/pdf" : "image/jpeg",
      base64: arrayBufferToBase64(buf),
    });
  } else {
    window.open(url, "_blank");
  }
}
