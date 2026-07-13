import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaItem } from "@/lib/media-types";
import { MediaCard } from "./MediaCard";
import { SectionHeader } from "./SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

export function MediaCarousel({
  title,
  subtitle,
  action,
  items,
  isLoading,
  hideWhenEmpty,
  onHideItem,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; to: string };
  items: MediaItem[];
  isLoading?: boolean;
  hideWhenEmpty?: boolean;
  /** When provided, each card shows a "pas intéressé" dismiss control. */
  onHideItem?: (item: MediaItem) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 4);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, items.length, isLoading]);

  const scrollByCards = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Scroll by roughly the number of fully visible cards (card ~180px + gap).
    const cardStep = 180 + 16;
    const visible = Math.max(1, Math.floor(el.clientWidth / cardStep));
    el.scrollBy({ left: dir * cardStep * visible, behavior: "smooth" });
  }, []);

  if (hideWhenEmpty && !isLoading && !items.length) return null;

  const uniqueItems = items.filter(
    (item, i, arr) => arr.findIndex((x) => x.key === item.key) === i,
  );

  const arrowBtn =
    "absolute top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 p-2 text-foreground shadow-lg backdrop-blur transition-all hover:scale-110 hover:bg-background hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-0 md:flex";

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
      ) : uniqueItems.length ? (
        <div className="group/carousel relative">
          <button
            type="button"
            aria-label="Défiler vers la gauche"
            onClick={() => scrollByCards(-1)}
            disabled={!canLeft}
            className={cn(arrowBtn, "left-1")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Défiler vers la droite"
            onClick={() => scrollByCards(1)}
            disabled={!canRight}
            className={cn(arrowBtn, "right-1")}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div
            ref={scrollerRef}
            className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2"
          >
            {uniqueItems.map((item) => (
              <MediaCard
                key={item.key}
                item={item}
                className="w-[150px] shrink-0 snap-start sm:w-[180px]"
              />
            ))}
          </div>
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
