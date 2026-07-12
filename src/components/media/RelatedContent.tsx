import { GitBranch, Layers, Link2, Sparkles } from "lucide-react";
import type { RelatedMedia, RelationCategory } from "@/lib/media-types";
import { groupRelated } from "@/lib/franchise";
import { FicheSection } from "./FicheSection";
import { RelatedScroller } from "./RelatedScroller";

const CATEGORY_ICON: Record<RelationCategory, typeof GitBranch> = {
  franchise: GitBranch,
  adaptation: Link2,
  recommendation: Sparkles,
  other: Layers,
};

/**
 * Renders linked content as clean, ordered franchise/adaptation/reco groups.
 * Falls back to nothing when there's no related content.
 */
export function RelatedContent({
  related,
  collectionName,
}: {
  related: RelatedMedia[];
  collectionName?: string | null;
}) {
  const groups = groupRelated(related);
  if (!groups.length && !collectionName) return null;

  return (
    <div className="space-y-8">
      {collectionName ? (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <Layers className="h-5 w-5 shrink-0 text-primary" />
          <span className="text-sm">
            Fait partie de la saga{" "}
            <strong className="font-semibold">{collectionName}</strong>
          </span>
        </div>
      ) : null}

      {groups.map((group) => {
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
            />
          </FicheSection>
        );
      })}
    </div>
  );
}
