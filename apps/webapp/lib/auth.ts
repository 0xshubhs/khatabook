import type { User } from "./types";

const ACCESS_KEY = "kb_access";
const REFRESH_KEY = "kb_refresh";
const USER_KEY = "kb_user";

const isClient = typeof window !== "undefined";

/** Session token + user storage in localStorage (the app runs inside a WebView). */
export const session = {
  getAccess(): string | null {
    return isClient ? localStorage.getItem(ACCESS_KEY) : null;
  },
  getRefresh(): string | null {
    return isClient ? localStorage.getItem(REFRESH_KEY) : null;
  },
  getUser(): User | null {
    if (!isClient) return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  },
  set(access: string, refresh: string, user: User): void {
    if (!isClient) return;
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  /** Rotate just the tokens (used by silent refresh — the user object is unchanged). */
  setTokens(access: string, refresh: string): void {
    if (!isClient) return;
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  setUser(user: User): void {
    if (isClient) localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear(): void {
    if (!isClient) return;
    [ACCESS_KEY, REFRESH_KEY, USER_KEY].forEach((k) => localStorage.removeItem(k));
  },
};
