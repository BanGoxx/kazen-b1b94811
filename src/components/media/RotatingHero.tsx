import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Info, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { MediaItem } from "@/lib/media-types";
import { MEDIA_TYPE_LABELS } from "@/lib/media-types";
import { RatingBadge } from "./RatingBadge";
import { PlatformRow } from "./PlatformBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROTATE_MS = 7000;

/**
 * Premium rotating hero. Shows one featured title at a time (anime-first),
 * with a slow ~7s auto-rotation that pauses on hover/focus, discreet pill
 * navigation, and strong image presence. Falls back gracefully to a single
 * static slide when only one item is available.
 */
export function RotatingHero({ items }: { items: MediaItem[] }) {
  const slides = items.filter((it, i, arr) => arr.findIndex((x) => x.key === it.key) === i).slice(0, 5);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const go = useCallback(
    (next: number) => setIndex((prev) => (count ? (next + count) % count : 0)),
    [count],
  );

  // Auto-rotation — respects reduced motion and pauses on hover/focus.
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (count <= 1 || paused) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    timer.current = setInterval(() => setIndex((p) => (p + 1) % count), ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [count, paused]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (!count) return null;
  const active = slides[Math.min(index, count - 1)];

  return (
    <section
      className="grain relative mb-12 overflow-hidden rounded-[1.75rem] border border-border shadow-[var(--shadow-float)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carrousel"
      aria-label="À la une"
    >
      {/* Stacked backdrops crossfade between slides */}
      <div className="absolute inset-0">
        {slides.map((item, i) => (
          <div
            key={item.key}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-out",
              i === index ? "opacity-100" : "opacity-0",
            )}
            aria-hidden={i !== index}
          >
            {item.backdropUrl || item.posterUrl ? (
              <img
                src={item.backdropUrl || item.posterUrl || ""}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "low"}
                decoding="async"
                className="h-full w-full scale-105 object-cover"
              />
            ) : (
              <div className="h-full w-full aurora-bg opacity-40" />
            )}
          </div>
        ))}
        <div className="cinematic-scrim absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
      </div>

      {/* Foreground content keyed on the active slide for a subtle fade-in */}
      <div
        key={active.key}
        className="animate-fade-in relative flex min-h-[26rem] flex-col justify-end gap-5 p-6 sm:min-h-[30rem] sm:p-10 lg:max-w-2xl"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded-full aurora-bg px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-[var(--shadow-glow)]">
            <Sparkles className="h-3 w-3" /> {MEDIA_TYPE_LABELS[active.mediaType]}
          </span>
          <RatingBadge score={active.score} />
          {active.genres.slice(0, 3).map((g) => (
            <span
              key={g}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur"
            >
              {g}
            </span>
          ))}
        </div>
        <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl">
          {active.title}
        </h1>
        {active.synopsis ? (
          <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {active.synopsis}
          </p>
        ) : null}
        <PlatformRow platforms={active.platforms} max={4} />
        <div className="mt-2 flex flex-wrap gap-3">
          <Button
            asChild
            size="lg"
            className="aurora-bg text-white shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.03] hover:opacity-95"
          >
            <Link to="/media/$source/$id" params={{ source: active.source, id: active.externalId }}>
              <Info className="mr-1 h-4 w-4" /> Voir la fiche
            </Link>
          </Button>
        </div>
      </div>

      {/* Discreet navigation — arrows on desktop, pills everywhere */}
      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label="Slide précédent"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-background/60 p-2 text-foreground backdrop-blur transition-all hover:scale-110 hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Slide suivant"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-background/60 p-2 text-foreground backdrop-blur transition-all hover:scale-110 hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-5 right-6 z-10 flex items-center gap-2" role="tablist" aria-label="Choisir une diapositive">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Diapositive ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === index ? "w-7 bg-primary" : "w-2.5 bg-white/30 hover:bg-white/60",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
