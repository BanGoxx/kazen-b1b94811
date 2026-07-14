// KAZEN Phase 15.2 — Assistant response-cache eligibility + key helpers.
//
// Pure, deterministic helpers (no I/O) shared by the /api/chat route. They
// decide whether a request is a *safely shareable* catalogue query and build
// a stable cache key. Personalized or multi-turn requests are never cached
// across users.

import type { UIMessage } from "ai";

// Bump these when the semantics of a cached answer change, so old entries are
// ignored automatically (the version is part of the cache key).
export const ASSISTANT_PROMPT_VERSION = 1;
export const ASSISTANT_RESPONSE_FORMAT_VERSION = 1;
export const ASSISTANT_MODEL_ID = "google/gemini-3-flash-preview";

// FR/EN markers that imply the answer depends on the member's own profile,
// list, history or a previous turn — these must NOT use the shared cache.
const PERSONAL_MARKERS: RegExp[] = [
  /\bmes\s+go[uû]ts?\b/i,
  /\bmes\s+pr[ée]f[ée]rences?\b/i,
  /\bmes\s+favoris\b/i,
  /\bma\s+liste\b/i,
  /\bmes\s+listes\b/i,
  /\bma\s+watchlist\b/i,
  /\bma\s+collection\b/i,
  /\bmon\s+historique\b/i,
  /\bmon\s+profil\b/i,
  /\bpour\s+moi\b/i,
  /\bselon\s+mo[in]\b/i,
  /\bd'?apr[èe]s\s+mes\b/i,
  /\bque\s+j'?ai\s+(d[ée]j[àa]\s+)?(vu|regard[ée]|aim[ée])\b/i,
  /\bj'?ai\s+d[ée]j[àa]\s+vu\b/i,
  /\btu\s+m'?as\s+(conseill[ée]|recommand[ée]|dit|propos[ée])\b/i,
  /\bcomme\s+(avant|pr[ée]c[ée]demment|tout\s+à\s+l'heure)\b/i,
  /\bmy\s+(list|taste|history|profile|watchlist|favorites?)\b/i,
  /\bfor\s+me\b/i,
  /\bbased\s+on\s+my\b/i,
  /\byou\s+(recommended|told\s+me|suggested)\b/i,
];

function textOf(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

/** Collapse whitespace, lowercase, strip trailing punctuation for keying. */
export function normalizeQuery(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s?!.…,;:]+$/g, "")
    .trim();
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: "multi_turn" | "personalized" | "empty";
  normalized: string;
}

/**
 * A request is cache-eligible only when it is the FIRST user turn (no prior
 * assistant reply, exactly one user message) and contains no personalization
 * markers. Anything else is treated as contextual/personalized.
 */
export function evaluateEligibility(messages: UIMessage[]): EligibilityResult {
  const userMsgs = messages.filter((m) => m.role === "user");
  const hasAssistant = messages.some((m) => m.role === "assistant");
  const last = userMsgs[userMsgs.length - 1];
  const normalized = last ? normalizeQuery(textOf(last)) : "";

  if (!normalized) return { eligible: false, reason: "empty", normalized };
  if (hasAssistant || userMsgs.length > 1) {
    return { eligible: false, reason: "multi_turn", normalized };
  }
  if (PERSONAL_MARKERS.some((re) => re.test(normalized))) {
    return { eligible: false, reason: "personalized", normalized };
  }
  return { eligible: true, normalized };
}

/**
 * Build the cache key material. The raw query is hashed by the caller; this
 * function assembles the versioned, deterministic components.
 */
export function cacheKeyMaterial(params: {
  normalized: string;
  catalogueVersion: number;
}): string {
  return [
    "v2",
    `mode=shared`,
    `model=${ASSISTANT_MODEL_ID}`,
    `prompt=${ASSISTANT_PROMPT_VERSION}`,
    `format=${ASSISTANT_RESPONSE_FORMAT_VERSION}`,
    `cat=${params.catalogueVersion}`,
    `q=${params.normalized}`,
  ].join("|");
}

/** SHA-256 hex digest via Web Crypto (available in the Worker runtime). */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
