/**
 * Locale-aware date formatting via `Intl`. Callers pass the active locale and
 * an options object; no manual month/day tables.
 */
import type { Locale } from "@/lib/i18n/locales";

const LOCALE_MAP: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
};

export function formatDateLocalized(
  input: string | number | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
): string {
  try {
    return new Intl.DateTimeFormat(LOCALE_MAP[locale], options).format(new Date(input));
  } catch {
    return "";
  }
}

export function formatRelativeLocalized(
  from: Date,
  to: Date,
  locale: Locale,
): string {
  const diffMs = from.getTime() - to.getTime();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(LOCALE_MAP[locale], { numeric: "auto" });
  const seconds = Math.round(diffMs / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  if (abs < 60_000) return rtf.format(seconds, "second");
  if (abs < 3_600_000) return rtf.format(minutes, "minute");
  if (abs < 86_400_000) return rtf.format(hours, "hour");
  return rtf.format(days, "day");
}
