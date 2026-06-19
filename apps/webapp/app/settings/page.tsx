"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { Button, Field, Spinner, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { nativeBridge } from "@/lib/native-bridge";
import { pinLock } from "@/lib/pin";
import { useBusinesses } from "@/lib/queries";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isReady, logout, updateUser, locale, setLocale } = useAuth();
  const t = useTranslations("settings");
  const qc = useQueryClient();
  const { data: businesses } = useBusinesses();
  const business = businesses?.[0];

  // profile form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // business form
  const [bizName, setBizName] = useState("");
  const [bizSaved, setBizSaved] = useState(false);

  // pin
  const [pin, setPin] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

  // biometric app lock (native shell only)
  const [appLock, setAppLock] = useState<boolean | null>(null);
  const isNative = nativeBridge.isAvailable();

  useEffect(() => {
    if (isReady && !user) router.replace("/login");
  }, [isReady, user, router]);
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);
  useEffect(() => setBizName(business?.name ?? ""), [business]);
  useEffect(() => setHasPin(pinLock.hasPin()), []);
  useEffect(() => {
    nativeBridge.getAppLock().then((v) => setAppLock(v ?? false));
  }, []);

  function toggleAppLock() {
    const next = !appLock;
    setAppLock(next);
    nativeBridge.setAppLock(next).catch(() => {});
  }

  if (!isReady || !user) return <Spinner />;

  async function saveProfile() {
    const updated = await api.updateProfile({ name: name.trim() || undefined, email: email.trim() });
    updateUser(updated);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function saveBusiness() {
    if (!business || !bizName.trim()) return;
    await api.updateBusiness(business.id, { name: bizName.trim() });
    qc.invalidateQueries({ queryKey: ["businesses"] });
    setBizSaved(true);
    setTimeout(() => setBizSaved(false), 2000);
  }

  async function savePin() {
    if (!/^\d{4}$/.test(pin)) return;
    await pinLock.setPin(pin);
    api.setPin(pin).catch(() => {});
    setHasPin(true);
    setPin("");
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 2000);
  }

  function removePin() {
    pinLock.clear();
    setHasPin(false);
  }

  return (
    <main className="pb-10">
      <header className="flex items-center gap-3 bg-accent px-4 py-3 text-white">
        <Link href="/" className="text-xl leading-none">
          ‹
        </Link>
        <span className="text-base font-semibold">{t("title")}</span>
      </header>

      <section className="space-y-4 p-4">
        {/* Profile */}
        <div className="rounded-xl bg-white p-4">
          <div className="mb-3 text-sm font-semibold">{t("profile")}</div>
          <Field label={t("name")}>
            <input
              className={inputClass}
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label={t("phone")}>
            <input className={`${inputClass} text-gray-500`} value={user.phone} disabled readOnly />
          </Field>
          <Field label={t("email")}>
            <input
              className={inputClass}
              type="email"
              inputMode="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button className="w-full" onClick={saveProfile}>
            {profileSaved ? t("saved") : t("save")}
          </Button>
        </div>

        {/* Business */}
        <div className="rounded-xl bg-white p-4">
          <div className="mb-3 text-sm font-semibold">{t("business")}</div>
          <Field label={t("businessName")}>
            <input
              className={inputClass}
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
            />
          </Field>
          <Button className="w-full" disabled={!bizName.trim()} onClick={saveBusiness}>
            {bizSaved ? t("saved") : t("save")}
          </Button>
        </div>

        {/* Language */}
        <div className="rounded-xl bg-white p-4">
          <div className="mb-2 text-sm font-medium">{t("language")}</div>
          <div className="flex gap-2">
            {LOCALES.map((l: Locale) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  locale === l
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                {LOCALE_LABELS[l]}
              </button>
            ))}
          </div>
        </div>

        {/* App-lock PIN */}
        <div className="rounded-xl bg-white p-4">
          <div className="mb-2 text-sm font-medium">{t("pin")}</div>
          <Field label={t("pinPlaceholder")}>
            <input
              className={inputClass}
              inputMode="numeric"
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!/^\d{4}$/.test(pin)} onClick={savePin}>
              {pinSaved ? t("pinSet") : t("setPin")}
            </Button>
            {hasPin && (
              <Button variant="ghost" onClick={removePin}>
                {t("removePin")}
              </Button>
            )}
          </div>
        </div>

        {/* Biometric app lock — only meaningful inside the native app shell */}
        {isNative && (
          <div className="rounded-xl bg-white p-4">
            <button
              type="button"
              onClick={toggleAppLock}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span>
                <span className="block text-sm font-medium">{t("appLock")}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{t("appLockHint")}</span>
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  appLock ? "bg-accent" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    appLock ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          </div>
        )}

        <Button variant="due" className="w-full" onClick={logout}>
          {t("logout")}
        </Button>
      </section>
    </main>
  );
}
