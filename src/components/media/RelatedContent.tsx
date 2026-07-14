import { useState } from "react";
import { GitBranch, Layers, Link2, Sparkles } from "lucide-react";
import type { RelatedMedia, RelationCategory } from "@/lib/media-types";
import { groupRelated } from "@/lib/franchise";
import { cn } from "@/lib/utils";
import { FicheSection } from "./FicheSection";
import { RelatedScroller } from "./RelatedScroller";

const CATEGORY_ICON: Record<RelationCategory, typeof GitBranch> = {
  franchise: GitBranch,
  adaptation: Link2,
  recommendation: Sparkles,
  other: Layers,
};

type WorkType = "anime" | "serie" | "film" | "autre";

const TYPE_LABELS: Record<Exclude<WorkType, "autre">, string> = {
  anime: "Anime",
  serie: "Série",
  film: "Film",
};

const FILM_RE = /film|movie/i;

/**
 * Reliable media-type classification derived from provider format signals —
 * never from the title text. Manga/novel/music/other formats are grouped as
 * "autre" and remain visible only under the "Tout" filter.
 */
function workType(it: RelatedMedia): WorkType {
  const fg = it.formatGroup ?? "anime";
  if (fg !== "anime") return "autre";
  if (FILM_RE.test(it.format ?? "") || it.mediaType === "movie") return "film";
  if (it.mediaType === "series") return "serie";
  return "anime";
}


/**
 * Renders linked content as clean, ordered franchise/adaptation/reco groups.
 * When several groups exist, a lightweight filter lets the reader focus one
 * group at a time (default "Tout"). Falls back to nothing when there's no
 * related content.
 */
export function RelatedContent({
  related,
  collectionName,
}: {
  related: RelatedMedia[];
  collectionName?: string | null;
}) {
  const groups = groupRelated(related);
  const [active, setActive] = useState<RelationCategory | "all">("all");
  const [typeFilter, setTypeFilter] = useState<WorkType | "all">("all");
  if (!groups.length && !collectionName) return null;

  const showFilter = groups.length > 1;

  // Which work types are actually present drives the type-filter row.
  const presentTypes = new Set<WorkType>();
  for (const g of groups) for (const it of g.items) presentTypes.add(workType(it));
  const availableTypes = (["anime", "serie", "film"] as const).filter((t) =>
    presentTypes.has(t),
  );
  const showTypeFilter = availableTypes.length > 1;

  // Apply the relationship-group filter first, then the media-type filter on the
  // items within each group. Grouping (franchise/adaptation/…) is preserved.
  const byCategory =
    active === "all" ? groups : groups.filter((g) => g.category === active);
  const visible = byCategory
    .map((g) => ({
      ...g,
      items:
        typeFilter === "all"
          ? g.items
          : g.items.filter((it) => workType(it) === typeFilter),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {collectionName ? (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <Layers className="h-5 w-5 shrink-0 text-primary" />
          <span className="text-sm">
            Fait partie de la saga{" "}
            <strong className="font-semibold">{collectionName}</strong>
          </span>
        </div>
      ) : null}

      {showTypeFilter ? (
        <div
          role="tablist"
          aria-label="Filtrer par type"
          className="flex flex-wrap gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
            className={cn(
              "focus-ring rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              typeFilter === "all"
                ? "aurora-bg text-white"
                : "border border-border bg-card/60 text-muted-foreground hover:text-foreground",
            )}
          >
            Tout
          </button>
          {availableTypes.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={typeFilter === t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "focus-ring rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                typeFilter === t
                  ? "aurora-bg text-white"
                  : "border border-border bg-card/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      ) : null}

      {showFilter ? (
        <div
          role="tablist"
          aria-label="Filtrer les contenus liés"
          className="flex flex-wrap gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={active === "all"}
            onClick={() => setActive("all")}
            className={cn(
              "focus-ring rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              active === "all"
                ? "aurora-bg text-white"
                : "border border-border bg-card/60 text-muted-foreground hover:text-foreground",
            )}
          >
            Tout
          </button>
          {groups.map((group) => {
            const Icon = CATEGORY_ICON[group.category];
            const selected = active === group.category;
            return (
              <button
                key={group.category}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(group.category)}
                className={cn(
                  "focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  selected
                    ? "aurora-bg text-white"
                    : "border border-border bg-card/60 text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {group.title}
              </button>
            );
          })}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun contenu lié ne correspond à ce filtre.
        </p>
      ) : (
        visible.map((group) => {
          const Icon = CATEGORY_ICON[group.category];
          return (
            <FicheSection
              key={group.category}
              title={group.title}
              icon={<Icon className="h-5 w-5" />}
            >
              <RelatedScroller
                title=""
                description={group.description}
                items={group.items}
                showSeasonBadges={group.category === "franchise"}
              />
            </FicheSection>
          );
        })
      )}
    </div>
  );
}

