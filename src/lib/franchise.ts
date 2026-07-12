// Franchise & linked-content logic for KAZEN fiches.
//
// This module turns a flat list of RelatedMedia into clean, ordered groups so
// detail pages can present sequels / prequels / spin-offs / adaptations /
// recommendations in a readable, premium way — inspired by Nautiljon's depth
// but far less cluttered.
//
// It is deliberately source-agnostic and side-effect free so it can later back
// dedicated franchise/group pages (e.g. /franchise/$key) without a rewrite.

import type { MediaSource, RelatedMedia, RelationCategory } from "./media-types";

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
      items.sort((a, b) => {
        const wa = FRANCHISE_RELATION_ORDER[a.relation] ?? 99;
        const wb = FRANCHISE_RELATION_ORDER[b.relation] ?? 99;
        if (wa !== wb) return wa - wb;
        return a.title.localeCompare(b.title, "fr");
      });
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
