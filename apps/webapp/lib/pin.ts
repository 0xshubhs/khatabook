// Webapp app-lock PIN (SPEC §3). Stored as a SHA-256 hash in localStorage and
// verified locally so the lock works offline. (Biometric unlock is handled by
// the RN shell.) A copy is also synced to the server via /auth/set-pin.

const PIN_KEY = "kb_pin_hash";
const isClient = typeof window !== "undefined";

async function hash(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const pinLock = {
  hasPin(): boolean {
    return isClient && !!localStorage.getItem(PIN_KEY);
  },
  async setPin(pin: string): Promise<void> {
    localStorage.setItem(PIN_KEY, await hash(pin));
  },
  clear(): void {
    if (isClient) localStorage.removeItem(PIN_KEY);
  },
  async verify(pin: string): Promise<boolean> {
    if (!isClient) return false;
    return localStorage.getItem(PIN_KEY) === (await hash(pin));
  },
};
