// KAZEN email eligibility — Phase 2 (centralized, reusable, pure).
//
// This is the single source of truth for "is a member eligible to RECEIVE a
// given digest". It is used by the (future) member send path and is exercised
// now so the rules are locked before any member email is ever sent.
//
// Founder test sends deliberately DO NOT use this function — the founder test
// is an explicit, Owner-only bypass that targets the Owner's OWN verified
// email only (enforced server-side). There is no generic bypass that could
// ever leak into a member send.

import type { EmailPreferences } from "../email-prefs.functions";

export type DigestVariant = "general" | "personalized";

/**
 * A member is eligible for a digest only when they have explicitly opted in
 * AND their frequency is not "never". No preference row = not eligible.
 * Consent for general and personalized digests is tracked independently.
 */
export function isDigestEligible(
  prefs: EmailPreferences | null | undefined,
  variant: DigestVariant,
): boolean {
  if (!prefs) return false;
  if (prefs.digest_frequency === "never") return false;
  return variant === "general"
    ? prefs.receive_general_digest === true
    : prefs.receive_personalized_digest === true;
}
