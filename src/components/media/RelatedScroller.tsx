import { Link } from "@tanstack/react-router";
import type { RelatedMedia } from "@/lib/media-types";
import { SafeImage } from "./SafeImage";

export function RelatedScroller({
  title,
  items,
}: {
  title: string;
  items: RelatedMedia[];
}) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold">{title}</h2>
      <ul className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((it) => (
          <li key={it.key} className="w-32 shrink-0 snap-start">
            <Link
              to="/media/$source/$id"
              params={{ source: it.source, id: it.externalId }}
              className="group block focus-visible:outline-none"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted">
                {it.posterUrl ? (
                  <img
                    src={it.posterUrl}
                    alt={it.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
                <span className="absolute left-1.5 top-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[0.65rem] font-semibold backdrop-blur">
                  {it.relation}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-tight group-hover:text-primary">
                {it.title}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
