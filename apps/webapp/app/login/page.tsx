"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { useAuth } from "@/components/providers";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const { user, isReady, login } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && user) router.replace("/");
  }, [isReady, user, router]);

  async function sendOtp() {
    setBusy(true);
    setError(null);
    try {
      await api.requestOtp("+91" + phone);
      setStep("otp");
    } catch {
      setError(t("invalidOtp"));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.verifyOtp("+91" + phone, otp.trim());
      login(result);
      router.replace("/");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? t("invalidOtp") : t("invalidOtp"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center px-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mb-8 mt-1 text-sm text-gray-500">{t("subtitle")}</p>

      {step === "phone" ? (
        <>
          <Field label={t("phoneLabel")}>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                +91
              </span>
              <input
                className={inputClass}
                type="tel"
                inputMode="numeric"
                autoFocus
                maxLength={10}
                placeholder={t("phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </div>
          </Field>
          <Button
            className="mt-2"
            disabled={busy || phone.length !== 10}
            onClick={sendOtp}
          >
            {busy ? t("sending") : t("sendOtp")}
          </Button>
        </>
      ) : (
        <>
          <Field label={t("otpLabel")}>
            <input
              className={inputClass}
              inputMode="numeric"
              autoFocus
              maxLength={6}
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </Field>
          <p className="mb-3 text-xs text-gray-400">{t("otpHint")}</p>
          <Button className="mt-2" disabled={busy || otp.trim().length !== 6} onClick={verify}>
            {busy ? t("verifying") : t("verify")}
          </Button>
          <button
            className="mt-3 text-sm text-gray-500 underline"
            onClick={() => {
              setStep("phone");
              setError(null);
            }}
          >
            {t("back")}
          </button>
        </>
      )}

      {error && <p className="mt-4 text-sm text-due">{error}</p>}
    </main>
  );
}
