/**
 * KAZEN — Phase 27 i18n runtime.
 *
 * SSR-safe: server always renders with `DEFAULT_LOCALE` (fr). The persisted
 * preference is read from localStorage inside a `useEffect`, then applied
 * to <html lang> and to the React tree. This avoids hydration mismatches
 * and keeps French as the authoritative source language.
 *
 * Persistence: localStorage only (functional preference, no personal data,
 * compatible with the Phase 26.3 consent model — no marketing cookie
 * dependency).
 */

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
  DICTIONARIES,
  LOCALES,
  type Dict,
  type Locale,
} from "./locales";

const STORAGE_KEY = "kazen-locale";

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* localStorage may be blocked; fall back to navigator */
  }
  const nav = window.navigator?.language?.toLowerCase() ?? "";
  if (nav.startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: Dict;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  // Server + first client render use DEFAULT_LOCALE to keep hydration stable.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const detected = detectInitialLocale();
    if (detected !== DEFAULT_LOCALE) setLocaleState(detected);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", locale);
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore storage errors — the user preference just won't persist */
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: DICTIONARIES[locale] }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Graceful fallback so components used outside a provider (tests, isolated
  // stories) still render in French rather than crashing.
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => undefined,
    t: DICTIONARIES[DEFAULT_LOCALE],
  };
}

export { LOCALES, DEFAULT_LOCALE };
export type { Locale };
