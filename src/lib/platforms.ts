import type { Platform } from "./media-types";

// Internal catalogue of streaming platforms with coherent FR branding.
// Keyed by a normalized slug; TMDB provider names + AniList sites map into these.
interface PlatformDef {
  id: string;
  name: string;
  color: string;
  aliases: string[];
  /**
   * Official platform base page (FR-localized where relevant). This is the
   * guaranteed-safe fallback destination for every badge: a real, official
   * provider homepage rather than a random/generic or third-party page.
   */
  base: string;
  /**
   * Hostnames that count as a *reliable direct* provider destination. A deep
   * link is only followed when it points at one of these official domains;
   * anything else (e.g. JustWatch aggregator links) falls back to `base`.
   */
  officialHosts: string[];
  /**
   * When true we never follow the deep link and always redirect to `base`,
   * because that provider's title deep links are unreliable / frame-blocked
   * (Crunchyroll title pages send X-Frame-Options + often 404 by region).
   */
  preferBase?: boolean;
}

export const PLATFORMS: PlatformDef[] = [
  { id: "netflix", name: "Netflix", color: "#E50914", aliases: ["netflix"], base: "https://www.netflix.com/fr/", officialHosts: ["netflix.com"] },
  { id: "prime", name: "Prime Video", color: "#00A8E1", aliases: ["amazon prime video", "prime video", "amazon video"], base: "https://www.primevideo.com/", officialHosts: ["primevideo.com", "amazon.fr", "amazon.com"] },
  { id: "crunchyroll", name: "Crunchyroll", color: "#F47521", aliases: ["crunchyroll"], base: "https://www.crunchyroll.com/fr/", officialHosts: ["crunchyroll.com"], preferBase: true },
  { id: "adn", name: "ADN", color: "#0098DB", aliases: ["adn", "animation digital network"], base: "https://animationdigitalnetwork.com/", officialHosts: ["animationdigitalnetwork.com", "animationdigitalnetwork.fr", "adn.tv"] },
  { id: "disney", name: "Disney+", color: "#113CCF", aliases: ["disney plus", "disney+"], base: "https://www.disneyplus.com/fr-fr", officialHosts: ["disneyplus.com"] },
  { id: "canal", name: "Canal+", color: "#000000", aliases: ["canal+", "canal plus"], base: "https://www.canalplus.com/", officialHosts: ["canalplus.com"] },
  { id: "appletv", name: "Apple TV+", color: "#000000", aliases: ["apple tv plus", "apple tv+", "apple tv"], base: "https://tv.apple.com/fr", officialHosts: ["tv.apple.com", "apple.com"] },
  { id: "max", name: "Max", color: "#0046FF", aliases: ["max", "hbo max"], base: "https://www.max.com/fr/fr", officialHosts: ["max.com", "hbomax.com"] },
  { id: "paramount", name: "Paramount+", color: "#0064FF", aliases: ["paramount plus", "paramount+"], base: "https://www.paramountplus.com/fr/", officialHosts: ["paramountplus.com"] },
  { id: "ocs", name: "OCS", color: "#F90026", aliases: ["ocs", "orange cinema series"], base: "https://www.ocs.fr/", officialHosts: ["ocs.fr"] },
];

const ALIAS_INDEX: Record<string, PlatformDef> = (() => {
  const idx: Record<string, PlatformDef> = {};
  for (const p of PLATFORMS) for (const a of p.aliases) idx[a] = p;
  return idx;
})();

const ID_INDEX: Record<string, PlatformDef> = (() => {
  const idx: Record<string, PlatformDef> = {};
  for (const p of PLATFORMS) idx[p.id] = p;
  return idx;
})();

/** Resolve an external provider name into an internal Platform, when known.
 *  `url` is the raw title-specific deep link (AniList link or TMDB/JustWatch
 *  page) and is kept as-is; the final safe destination is computed at click
 *  time by `platformDestination`, which falls back to the official base page. */
export function resolvePlatform(
  name: string,
  logoUrl: string | null,
  type: Platform["type"] = "stream",
  url: string | null = null,
): Platform | null {
  const def = matchPlatform(name);
  if (!def) return null;
  return { id: def.id, name: def.name, logoUrl, color: def.color, type, url };
}

/** Normalize a provider label so aliases match despite punctuation/casing. */
function normalizeProvider(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Reseller / packaging suffixes TMDB appends to the base provider name
// ("Netflix Standard with Ads", "Crunchyroll Amazon Channel", "Paramount Plus
// Premium", "Apple TV Store"...). They must NOT hide a valid provider, so we
// strip them before/while matching against the official platform aliases.
const PROVIDER_SUFFIXES = [
  "standard with ads",
  "basic with ads",
  "with ads",
  "amazon channel",
  "amazon channels",
  "apple tv channel",
  "premium",
  "store",
];

/**
 * Resolve a raw provider name to an official platform. Tries an exact alias
 * match first, then a tolerant prefix match (after stripping reseller suffixes)
 * so packaging variants still surface the correct base platform. Aliases are
 * tested longest-first to avoid a short alias shadowing a more specific one.
 */
function matchPlatform(name: string): PlatformDef | null {
  const norm = normalizeProvider(name);
  if (!norm) return null;
  const exact = ALIAS_INDEX[name.trim().toLowerCase()] ?? ALIAS_INDEX[norm];
  if (exact) return exact;

  let stripped = norm;
  for (const suf of PROVIDER_SUFFIXES) {
    if (stripped.endsWith(" " + suf)) {
      stripped = stripped.slice(0, -suf.length - 1).trim();
    }
  }

  const candidates: { alias: string; def: PlatformDef }[] = [];
  for (const p of PLATFORMS) {
    for (const a of p.aliases) candidates.push({ alias: normalizeProvider(a), def: p });
  }
  candidates.sort((x, y) => y.alias.length - x.alias.length);
  for (const { alias, def } of candidates) {
    if (stripped === alias || stripped.startsWith(alias + " ")) return def;
  }
  return null;
}

/**
 * Compute the safe redirection destination for a provider badge.
 *
 * - Direct deep link is used ONLY when it points at the provider's official
 *   domain AND the provider is not flagged `preferBase`.
 * - Otherwise (missing link, aggregator link like JustWatch, unreliable /
 *   frame-blocked provider) we redirect to the official platform base page.
 */
export function platformDestination(id: string, url: string | null | undefined): string {
  const def = ID_INDEX[id];
  if (!def) return url ?? "";
  if (!def.preferBase && url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      if (def.officialHosts.some((h) => host === h || host.endsWith("." + h))) {
        return url;
      }
    } catch {
      // malformed URL -> fall through to base
    }
  }
  return def.base;
}

export function dedupePlatforms(platforms: Platform[]): Platform[] {
  const seen = new Set<string>();
  const out: Platform[] = [];
  for (const p of platforms) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
