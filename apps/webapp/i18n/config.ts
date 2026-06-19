import en from "./messages/en.json";
import hi from "./messages/hi.json";

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const TIME_ZONE = "Asia/Kolkata";

// `hi` mirrors the `en` key structure (it's completed in Phase 7).
export const messagesByLocale: Record<Locale, typeof en> = { en, hi };

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
};
