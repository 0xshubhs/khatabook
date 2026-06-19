// Bridge to the Expo RN shell (SPEC §9). The shell injects window.ReactNativeWebView;
// we postMessage requests and the shell replies via window.__khatabookBridgeResponse.
// Every method falls back gracefully so the webapp works in a plain browser too.

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __khatabookBridgeResponse?: (r: {
      requestId: string;
      result?: unknown;
      error?: string;
    }) => void;
  }
}

const pending = new Map<string, Pending>();

export function isNativeShell(): boolean {
  return typeof window !== "undefined" && !!window.ReactNativeWebView;
}

if (typeof window !== "undefined") {
  window.__khatabookBridgeResponse = (r) => {
    const p = pending.get(r.requestId);
    if (!p) return;
    pending.delete(r.requestId);
    if (r.error) p.reject(new Error(r.error));
    else p.resolve(r.result);
  };
}

function call<T>(type: string, payload?: unknown): Promise<T> {
  if (!isNativeShell()) return Promise.reject(new Error("native-shell-unavailable"));
  const requestId = crypto.randomUUID();
  return new Promise<T>((resolve, reject) => {
    pending.set(requestId, { resolve: resolve as (v: unknown) => void, reject });
    window.ReactNativeWebView!.postMessage(JSON.stringify({ type, requestId, payload }));
  });
}

export interface PickedContact {
  name: string;
  phone: string;
}

export const nativeBridge = {
  isAvailable: isNativeShell,

  /** Native share sheet (falls back to Web Share API / clipboard). */
  async share(text: string): Promise<void> {
    if (isNativeShell()) {
      await call<void>("share", { text });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ text }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(text);
  },

  /** Native contact picker; null on cancel or when unavailable. */
  async pickContact(): Promise<PickedContact | null> {
    if (!isNativeShell()) return null;
    return call<PickedContact | null>("pickContact");
  },

  biometricUnlock(): Promise<boolean> {
    return call<boolean>("biometricUnlock");
  },

  /** Save/share a file natively (WebView can't download blobs). */
  saveFile(payload: { filename: string; mimeType: string; base64: string }): Promise<boolean> {
    return call<boolean>("saveFile", payload);
  },

  /** Biometric app-lock preference, persisted by the native shell. null = not chosen yet. */
  async getAppLock(): Promise<boolean | null> {
    if (!isNativeShell()) return null;
    return call<boolean | null>("getAppLock");
  },
  async setAppLock(enabled: boolean): Promise<void> {
    if (!isNativeShell()) return;
    await call<boolean>("setAppLock", { enabled });
  },
};
