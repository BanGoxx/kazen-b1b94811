import type { MediaItem } from "@/lib/media-types";
import { MediaCard } from "./MediaCard";
import { SectionHeader } from "./SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";

export function MediaCarousel({
  title,
  subtitle,
  action,
  items,
  isLoading,
  hideWhenEmpty,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; to: string };
  items: MediaItem[];
  isLoading?: boolean;
  hideWhenEmpty?: boolean;
}) {
  if (hideWhenEmpty && !isLoading && !items.length) return null;
  return (
    <section className="animate-fade-in">
      <SectionHeader title={title} subtitle={subtitle} action={action} />
      {isLoading ? (
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[150px] shrink-0 space-y-2 sm:w-[180px]">
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : items.length ? (
        <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
          {items
            .filter((item, i, arr) => arr.findIndex((x) => x.key === item.key) === i)
            .map((item) => (
            <MediaCard
              key={item.key}
              item={item}
              className="w-[150px] shrink-0 snap-start sm:w-[180px]"
            />
          ))}
        </div>
      ) : (
        <EmptyState
          message="Rien à afficher ici pour l'instant."
          hint="Cette sélection se remplira dès que de nouveaux titres seront disponibles."
        />
      )}
    </section>
  );
}
