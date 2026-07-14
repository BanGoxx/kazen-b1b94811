/**
 * Localized error mapping. Provider messages (Supabase, network, validation)
 * are mapped to user-facing strings from the active dictionary. Raw technical
 * messages remain available in logs.
 */
import type { Dict } from "@/lib/i18n/locales";

export function mapErrorToMessage(err: unknown, t: Dict): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const m = raw.toLowerCase();

  if (!m) return t.errors.unknown;

  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return t.errors.authInvalidCredentials;
  if (m.includes("email not confirmed") || m.includes("confirm your email"))
    return t.errors.authEmailNotConfirmed;
  if (m.includes("user already registered") || m.includes("already exists"))
    return t.errors.authUserExists;
  if (m.includes("password") && (m.includes("short") || m.includes("weak") || m.includes("at least")))
    return t.errors.authWeakPassword;
  if (m.includes("rate limit") || m.includes("too many"))
    return t.errors.authRateLimit;
  if (m.includes("network") || m.includes("failed to fetch") || m.includes("fetch failed"))
    return t.errors.network;
  if (m.includes("permission") || m.includes("forbidden") || m.includes("not allowed"))
    return t.errors.permission;
  if (m.includes("not found") || m.includes("404"))
    return t.errors.notFound;
  if (m.includes("500") || m.includes("server error") || m.includes("internal"))
    return t.errors.server;
  if (m.includes("quota") || m.includes("limit reached"))
    return t.errors.aiQuotaExceeded;

  return t.errors.unknown;
}
