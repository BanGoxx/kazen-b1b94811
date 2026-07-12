import { Link } from "@tanstack/react-router";
import type { RelatedMedia } from "@/lib/media-types";
import { SafeImage } from "./SafeImage";

export function RelatedScroller({
  title,
  description,
  items,
}: {
  title: string;
  description?: string;
  items: RelatedMedia[];
}) {
  if (!items.length) return null;
  return (
    <section>
      {title || description ? (
        <div className="mb-3">
          {title ? <h2 className="font-display text-xl font-bold">{title}</h2> : null}
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      <ul className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((it) => (
          <li key={it.key} className="w-32 shrink-0 snap-start">
            <Link
              to="/media/$source/$id"
              params={{ source: it.source, id: it.externalId }}
              className="group block focus-visible:outline-none"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted">
                <SafeImage
                  src={it.posterUrl}
                  alt={it.title}
                  variant="poster"
                  fallbackLabel={it.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[0.65rem] font-semibold backdrop-blur">
                  {it.relation}
                </span>
                {it.format ? (
                  <span className="absolute bottom-1.5 right-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[0.6rem] font-medium text-muted-foreground backdrop-blur">
                    {it.format}
                  </span>
                ) : null}
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
