import type { MediaItem } from "@/lib/media-types";
import { MediaCard } from "./MediaCard";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const GRID = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export function MediaGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className={GRID}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[2/3] w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function MediaGrid({
  items,
  emptyLabel = "Aucun résultat pour le moment.",
  className,
}: {
  items: MediaItem[];
  emptyLabel?: string;
  className?: string;
}) {
  if (!items.length) return <EmptyState message={emptyLabel} />;
  const seen = new Set<string>();
  const unique = items.filter((item) => (seen.has(item.key) ? false : seen.add(item.key)));
  return (
    <div className={cn(GRID, className)}>
      {unique.map((item, i) => (
        <MediaCard
          key={item.key}
          item={item}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
        />
      ))}
    </div>
  );
}
