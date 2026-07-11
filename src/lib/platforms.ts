import type { Platform } from "./media-types";

// Internal catalogue of streaming platforms with coherent FR branding.
// Keyed by a normalized slug; TMDB provider names + AniList sites map into these.
interface PlatformDef {
  id: string;
  name: string;
  color: string;
  aliases: string[];
}

export const PLATFORMS: PlatformDef[] = [
  { id: "netflix", name: "Netflix", color: "#E50914", aliases: ["netflix"] },
  { id: "prime", name: "Prime Video", color: "#00A8E1", aliases: ["amazon prime video", "prime video", "amazon video"] },
  { id: "crunchyroll", name: "Crunchyroll", color: "#F47521", aliases: ["crunchyroll"] },
  { id: "adn", name: "ADN", color: "#0098DB", aliases: ["adn", "animation digital network"] },
  { id: "disney", name: "Disney+", color: "#113CCF", aliases: ["disney plus", "disney+"] },
  { id: "canal", name: "Canal+", color: "#000000", aliases: ["canal+", "canal plus"] },
  { id: "appletv", name: "Apple TV+", color: "#000000", aliases: ["apple tv plus", "apple tv+", "apple tv"] },
  { id: "max", name: "Max", color: "#0046FF", aliases: ["max", "hbo max"] },
  { id: "paramount", name: "Paramount+", color: "#0064FF", aliases: ["paramount plus", "paramount+"] },
  { id: "ocs", name: "OCS", color: "#F90026", aliases: ["ocs", "orange cinema series"] },
];

const ALIAS_INDEX: Record<string, PlatformDef> = (() => {
  const idx: Record<string, PlatformDef> = {};
  for (const p of PLATFORMS) for (const a of p.aliases) idx[a] = p;
  return idx;
})();

/** Resolve an external provider name into an internal Platform, when known. */
export function resolvePlatform(
  name: string,
  logoUrl: string | null,
  type: Platform["type"] = "stream",
): Platform | null {
  const def = ALIAS_INDEX[name.trim().toLowerCase()];
  if (!def) return null;
  return { id: def.id, name: def.name, logoUrl, color: def.color, type };
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
