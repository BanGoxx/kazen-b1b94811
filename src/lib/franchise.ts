// Franchise & linked-content logic for KAZEN fiches.
//
// This module turns a flat list of RelatedMedia into clean, ordered groups so
// detail pages can present sequels / prequels / spin-offs / adaptations /
// recommendations in a readable, premium way — inspired by Nautiljon's depth
// but far less cluttered.
//
// It is deliberately source-agnostic and side-effect free so it can later back
// dedicated franchise/group pages (e.g. /franchise/$key) without a rewrite.

import {
  FORMAT_GROUP_LABELS,
  FORMAT_GROUP_ORDER,
  type FormatGroup,
  type MediaDetail,
  type MediaSource,
  type RelatedMedia,
  type RelationCategory,
} from "./media-types";

export interface RelatedGroup {
  category: RelationCategory;
  title: string;
  description: string;
  items: RelatedMedia[];
}

const CATEGORY_META: Record<
  RelationCategory,
  { title: string; description: string; order: number }
> = {
  franchise: {
    title: "Dans la même franchise",
    description: "Suites, préquelles, spin-offs et histoires du même univers.",
    order: 0,
  },
  adaptation: {
    title: "Œuvres liées",
    description: "Sources originales et adaptations entre médias.",
    order: 1,
  },
  recommendation: {
    title: "À découvrir aussi",
    description: "Des titres dans le même esprit.",
    order: 2,
  },
  other: {
    title: "Autres contenus liés",
    description: "",
    order: 3,
  },
};

// Narrative ordering inside a franchise, from origin to derivatives.
const FRANCHISE_RELATION_ORDER: Record<string, number> = {
  Préquelle: 0,
  "Œuvre parente": 1,
  Suite: 2,
  "Histoire parallèle": 3,
  "Spin-off": 4,
  "Version alternative": 5,
  Résumé: 6,
};

/**
 * Group + de-duplicate related media into ordered, display-ready buckets.
 * Empty groups are omitted so the fiche never shows a hollow section.
 */
export function groupRelated(related: RelatedMedia[]): RelatedGroup[] {
  const seen = new Set<string>();
  const buckets = new Map<RelationCategory, RelatedMedia[]>();

  for (const item of related) {
    if (!item.key || seen.has(item.key)) continue;
    seen.add(item.key);
    const list = buckets.get(item.relationCategory) ?? [];
    list.push(item);
    buckets.set(item.relationCategory, list);
  }

  const groups: RelatedGroup[] = [];
  for (const [category, items] of buckets) {
    if (category === "franchise") {
      // Canonical franchise order: narrative relation first (préquelle →
      // suite → spin-off…), then release chronology, then title as a stable
      // final fallback so items never shuffle unpredictably.
      items.sort((a, b) => {
        const wa = FRANCHISE_RELATION_ORDER[a.relation] ?? 99;
        const wb = FRANCHISE_RELATION_ORDER[b.relation] ?? 99;
        if (wa !== wb) return wa - wb;
        return compareCanon(a, b);
      });
    } else {
      // Adaptations / recommendations / other: earliest-first chronology with
      // a title fallback so the visible order feels coherent, not random.
      items.sort(compareDateAsc);
    }
    const meta = CATEGORY_META[category];
    groups.push({ category, title: meta.title, description: meta.description, items });
  }

  groups.sort((a, b) => CATEGORY_META[a.category].order - CATEGORY_META[b.category].order);
  return groups;
}

/** True when a fiche has any franchise/adaptation link (a real universe). */
export function hasFranchiseLinks(related: RelatedMedia[]): boolean {
  return related.some(
    (r) => r.relationCategory === "franchise" || r.relationCategory === "adaptation",
  );
}

/**
 * Forward-looking: derive a stable franchise key from a fiche + its links so a
 * future /franchise/$key page can aggregate the same universe. We anchor on the
 * "parent" work when present, else on the current item. Not yet routed — kept
 * pure and exported so the relation system can evolve without breaking fiches.
 */
export function deriveFranchiseKey(
  self: { source: MediaSource; externalId: string },
  related: RelatedMedia[],
): string {
  const parent = related.find((r) => r.relation === "Œuvre parente");
  const anchor = parent ?? self;
  return `${anchor.source}:${anchor.externalId}`;
}

/**
 * Anchor a fiche to the work that best represents its universe. We prefer the
 * declared "Œuvre parente" so every sibling in the same universe resolves to
 * the SAME group page; otherwise the fiche itself is the anchor.
 */
export function deriveGroupAnchor(
  self: { source: MediaSource; externalId: string },
  related: RelatedMedia[],
): { source: MediaSource; externalId: string } {
  const parent = related.find((r) => r.relation === "Œuvre parente");
  if (parent) return { source: parent.source, externalId: parent.externalId };
  return { source: self.source, externalId: self.externalId };
}

// ---------- Group / franchise pages ----------

export interface GroupSection {
  formatGroup: FormatGroup;
  title: string;
  items: RelatedMedia[];
}

export interface FranchiseGroup {
  /** All universe works (self + linked), de-duplicated and ordered. */
  items: RelatedMedia[];
  /** Ordered sections by format family (empty families omitted). */
  sections: GroupSection[];
  /** Distinct known years, ascending — powers a decade filter. */
  years: number[];
}

function formatGroupOf(item: RelatedMedia): FormatGroup {
  return (item.formatGroup as FormatGroup) ?? "anime";
}

function byYearThenTitle(a: RelatedMedia, b: RelatedMedia): number {
  const ya = a.year ?? 99999;
  const yb = b.year ?? 99999;
  if (ya !== yb) return ya - yb;
  return a.title.localeCompare(b.title, "fr");
}

/**
 * Build a higher-level universe view from a fiche's detail. Only universe
 * links (franchise + adaptation) are aggregated — recommendations stay a
 * fiche-level concern. The current work is always included so the group page
 * shows the complete universe. Returns empty sections when there is not
 * enough linked content to justify a group page.
 */
export function buildFranchiseGroup(detail: MediaDetail): FranchiseGroup {
  const selfAsItem: RelatedMedia = {
    key: detail.key,
    source: detail.source,
    externalId: detail.externalId,
    title: detail.title,
    posterUrl: detail.posterUrl,
    relation: "Cette œuvre",
    relationCategory: "franchise",
    mediaType: detail.mediaType,
    format: detail.format,
    formatGroup: "anime",
    year: detail.releaseDate ? Number(detail.releaseDate.slice(0, 4)) || null : null,
    hasDetail: true,
  };

  const universe = detail.related.filter(
    (r) => r.relationCategory === "franchise" || r.relationCategory === "adaptation",
  );

  const seen = new Set<string>([selfAsItem.key]);
  const items: RelatedMedia[] = [selfAsItem];
  for (const item of universe) {
    if (!item.key || seen.has(item.key)) continue;
    seen.add(item.key);
    items.push(item);
  }
  items.sort(byYearThenTitle);

  const buckets = new Map<FormatGroup, RelatedMedia[]>();
  for (const item of items) {
    const g = formatGroupOf(item);
    const list = buckets.get(g) ?? [];
    list.push(item);
    buckets.set(g, list);
  }

  const sections: GroupSection[] = FORMAT_GROUP_ORDER.filter((g) => buckets.has(g)).map(
    (g) => ({ formatGroup: g, title: FORMAT_GROUP_LABELS[g], items: buckets.get(g)! }),
  );

  const years = Array.from(
    new Set(items.map((i) => i.year).filter((y): y is number => typeof y === "number")),
  ).sort((a, b) => a - b);

  return { items, sections, years };
}

/** A group page is only meaningful when the universe has multiple works. */
export function isRealGroup(group: FranchiseGroup): boolean {
  return group.items.length >= 2;
}

/** Decade bucket label for a year, e.g. 2014 -> "2010s". */
export function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}


// ---------- KAZEN Universe categories (Nautiljon-style tabs) ----------

/**
 * Deep-linkable universe categories. Each maps a RelatedMedia to a Nautiljon-
 * style tab. Some categories are structural placeholders (disc/doujinshi) that
 * stay empty until richer data lands — they are shown so the taxonomy is
 * stable and future-ready, with elegant empty states.
 */
export type UniversCategory =
  | "anime"
  | "manga"
  | "novel"
  | "oav"
  | "movie"
  | "music"
  | "goodies"
  | "disc"
  | "doujinshi";

export const UNIVERS_CATEGORY_LABELS: Record<UniversCategory, string> = {
  anime: "Animes",
  manga: "Mangas",
  novel: "Light novels",
  oav: "OAV / Spéciaux",
  movie: "Films",
  music: "OST / CD",
  goodies: "Goodies",
  disc: "DVD / Blu-ray",
  doujinshi: "Doujinshi",
};

export const UNIVERS_CATEGORY_ORDER: UniversCategory[] = [
  "anime",
  "movie",
  "oav",
  "manga",
  "novel",
  "music",
  "goodies",
  "disc",
  "doujinshi",
];

export const DEFAULT_UNIVERS_CATEGORY: UniversCategory = "anime";

export function isUniversCategory(value: unknown): value is UniversCategory {
  return (
    typeof value === "string" &&
    (UNIVERS_CATEGORY_ORDER as string[]).includes(value)
  );
}

const MOVIE_RE = /movie|film/i;
const OAV_RE = /ova|oav|ona|special|spécial|specials/i;

/** Classify a related item into a single, primary universe category. */
export function categorizeUniversItem(item: RelatedMedia): UniversCategory {
  const group = (item.formatGroup as FormatGroup) ?? "anime";
  const fmt = item.format ?? "";
  if (group === "manga") return "manga";
  if (group === "novel") return "novel";
  if (group === "music") return "music";
  if (group === "other") return "goodies";
  // anime family — split into film / oav / series
  if (MOVIE_RE.test(fmt)) return "movie";
  if (OAV_RE.test(fmt)) return "oav";
  return "anime";
}

/** Bucket a franchise group's items by universe category. */
export function itemsByUniversCategory(
  group: FranchiseGroup,
): Record<UniversCategory, RelatedMedia[]> {
  const buckets = Object.fromEntries(
    UNIVERS_CATEGORY_ORDER.map((c) => [c, [] as RelatedMedia[]]),
  ) as Record<UniversCategory, RelatedMedia[]>;
  for (const item of group.items) {
    buckets[categorizeUniversItem(item)].push(item);
  }
  return buckets;
}
