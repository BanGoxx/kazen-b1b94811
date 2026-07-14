import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * KAZEN — Cookie & tracker consent (Phase 26.3)
 *
 * Single source of truth for the user's consent choices. Only the categories
 * actually used by KAZEN are exposed here:
 *
 *  - `necessary` (always true): Supabase auth token, theme preference, session
 *    catalogue state, consent decision itself.
 *  - `externalMedia`: opt-in loading of external players (YouTube trailers and
 *    thumbnails). Off by default. When off, the player is replaced by a
 *    local placeholder — no request is issued to YouTube.
 *
 * No analytics or advertising categories are declared because KAZEN does not
 * ship any such tracker at the moment.
 */

export const CONSENT_VERSION = "2026-07-14";
const STORAGE_KEY = "kazen-consent:v1";

export interface ConsentPreferences {
  version: string;
  necessary: true;
  externalMedia: boolean;
  decidedAt: string;
}

const DENY_ALL: ConsentPreferences = {
  version: CONSENT_VERSION,
  necessary: true,
  externalMedia: false,
  decidedAt: "",
};

function isPreferences(value: unknown): value is ConsentPreferences {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.version === "string" &&
    v.necessary === true &&
    typeof v.externalMedia === "boolean" &&
    typeof v.decidedAt === "string"
  );
}

function readStored(): ConsentPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isPreferences(parsed)) return null;
    if (parsed.version !== CONSENT_VERSION) return null; // require re-consent on version bump
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(prefs: ConsentPreferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable */
  }
}

function clearStored() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

interface ConsentContextValue {
  /** Undecided when the user has not yet made a choice. */
  decided: boolean;
  prefs: ConsentPreferences;
  acceptAll: () => void;
  denyAll: () => void;
  save: (partial: Partial<Omit<ConsentPreferences, "version" | "necessary" | "decidedAt">>) => void;
  reset: () => void;
  openPreferences: () => void;
  closePreferences: () => void;
  preferencesOpen: boolean;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<ConsentPreferences>(DENY_ALL);
  const [decided, setDecided] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setPrefs(stored);
      setDecided(true);
    }
  }, []);

  const persist = useCallback((next: ConsentPreferences) => {
    writeStored(next);
    setPrefs(next);
    setDecided(true);
  }, []);

  const acceptAll = useCallback(() => {
    persist({
      version: CONSENT_VERSION,
      necessary: true,
      externalMedia: true,
      decidedAt: new Date().toISOString(),
    });
  }, [persist]);

  const denyAll = useCallback(() => {
    persist({
      version: CONSENT_VERSION,
      necessary: true,
      externalMedia: false,
      decidedAt: new Date().toISOString(),
    });
  }, [persist]);

  const save = useCallback<ConsentContextValue["save"]>(
    (partial) => {
      persist({
        version: CONSENT_VERSION,
        necessary: true,
        externalMedia: partial.externalMedia ?? prefs.externalMedia,
        decidedAt: new Date().toISOString(),
      });
    },
    [persist, prefs.externalMedia],
  );

  const reset = useCallback(() => {
    clearStored();
    setPrefs(DENY_ALL);
    setDecided(false);
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      decided,
      prefs,
      acceptAll,
      denyAll,
      save,
      reset,
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
      preferencesOpen,
    }),
    [decided, prefs, acceptAll, denyAll, save, reset, preferencesOpen],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    // Safe fallback when the provider is not mounted (e.g. isolated tests):
    // everything optional is refused, no-op mutators.
    return {
      decided: false,
      prefs: DENY_ALL,
      acceptAll: () => {},
      denyAll: () => {},
      save: () => {},
      reset: () => {},
      openPreferences: () => {},
      closePreferences: () => {},
      preferencesOpen: false,
    };
  }
  return ctx;
}
