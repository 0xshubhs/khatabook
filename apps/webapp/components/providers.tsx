"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  type Locale,
  LOCALES,
  messagesByLocale,
  TIME_ZONE,
} from "@/i18n/config";
import { session } from "@/lib/auth";
import { pinLock } from "@/lib/pin";
import { startSync } from "@/lib/sync";
import type { AuthResult, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  isReady: boolean;
  login: (result: AuthResult) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <Providers>");
  return ctx;
}

const LOCALE_KEY = "kb_locale";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  // Hydration-safe: start with defaults, read storage after mount.
  const [user, setUser] = useState<User | null>(null);
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    setUser(session.getUser());
    const stored = localStorage.getItem(LOCALE_KEY) as Locale | null;
    if (stored && LOCALES.includes(stored)) setLocaleState(stored);
    setReady(true);
  }, []);

  // Flush the offline outbox on load and whenever connectivity returns.
  useEffect(() => startSync(() => queryClient.invalidateQueries()), [queryClient]);

  const login = useCallback((result: AuthResult) => {
    session.set(result.accessToken, result.refreshToken, result.user);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    session.clear();
    setUser(null);
    queryClient.clear();
    router.replace("/login");
  }, [queryClient, router]);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(LOCALE_KEY, next);
    setLocaleState(next);
  }, []);

  const updateUser = useCallback((next: User) => {
    session.setUser(next);
    setUser(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isReady, login, logout, updateUser, locale, setLocale }),
    [user, isReady, login, logout, updateUser, locale, setLocale],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale={locale}
        messages={messagesByLocale[locale]}
        timeZone={TIME_ZONE}
      >
        <AuthContext.Provider value={value}>
          <LockGate>{children}</LockGate>
        </AuthContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

/** App-lock: if a PIN is set, require it before showing the app (when logged in). */
function LockGate({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setLocked(pinLock.hasPin());
  }, []);

  if (isReady && user && locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }
  return <>{children}</>;
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const t = useTranslations("lock");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  async function submit() {
    if (await pinLock.verify(pin)) onUnlock();
    else {
      setError(true);
      setPin("");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-8">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <input
        className="w-40 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-accent"
        inputMode="numeric"
        type="password"
        maxLength={4}
        autoFocus
        value={pin}
        onChange={(e) => {
          setError(false);
          setPin(e.target.value);
          if (e.target.value.length === 4) void pinLock.verify(e.target.value).then((ok) => ok && onUnlock());
        }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error && <p className="text-sm text-due">{t("wrong")}</p>}
    </main>
  );
}
