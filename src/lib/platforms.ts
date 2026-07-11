import type { Platform } from "./media-types";

// Internal catalogue of streaming platforms with coherent FR branding.
// Keyed by a normalized slug; TMDB provider names + AniList sites map into these.
interface PlatformDef {
  id: string;
  name: string;
  color: string;
  aliases: string[];
  /** Provider homepage, used as a graceful fallback when no deep link exists. */
  home: string;
}

export const PLATFORMS: PlatformDef[] = [
  { id: "netflix", name: "Netflix", color: "#E50914", aliases: ["netflix"], home: "https://www.netflix.com" },
  { id: "prime", name: "Prime Video", color: "#00A8E1", aliases: ["amazon prime video", "prime video", "amazon video"], home: "https://www.primevideo.com" },
  { id: "crunchyroll", name: "Crunchyroll", color: "#F47521", aliases: ["crunchyroll"], home: "https://www.crunchyroll.com" },
  { id: "adn", name: "ADN", color: "#0098DB", aliases: ["adn", "animation digital network"], home: "https://animationdigitalnetwork.com" },
  { id: "disney", name: "Disney+", color: "#113CCF", aliases: ["disney plus", "disney+"], home: "https://www.disneyplus.com" },
  { id: "canal", name: "Canal+", color: "#000000", aliases: ["canal+", "canal plus"], home: "https://www.canalplus.com" },
  { id: "appletv", name: "Apple TV+", color: "#000000", aliases: ["apple tv plus", "apple tv+", "apple tv"], home: "https://tv.apple.com" },
  { id: "max", name: "Max", color: "#0046FF", aliases: ["max", "hbo max"], home: "https://www.max.com" },
  { id: "paramount", name: "Paramount+", color: "#0064FF", aliases: ["paramount plus", "paramount+"], home: "https://www.paramountplus.com" },
  { id: "ocs", name: "OCS", color: "#F90026", aliases: ["ocs", "orange cinema series"], home: "https://www.ocs.fr" },
];

const ALIAS_INDEX: Record<string, PlatformDef> = (() => {
  const idx: Record<string, PlatformDef> = {};
  for (const p of PLATFORMS) for (const a of p.aliases) idx[a] = p;
  return idx;
})();

/** Resolve an external provider name into an internal Platform, when known.
 *  `url` is a title-specific deep link (AniList link or TMDB/JustWatch page);
 *  when absent we fall back to the provider's homepage so the badge stays useful. */
export function resolvePlatform(
  name: string,
  logoUrl: string | null,
  type: Platform["type"] = "stream",
  url: string | null = null,
): Platform | null {
  const def = ALIAS_INDEX[name.trim().toLowerCase()];
  if (!def) return null;
  return { id: def.id, name: def.name, logoUrl, color: def.color, type, url: url ?? def.home };
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
