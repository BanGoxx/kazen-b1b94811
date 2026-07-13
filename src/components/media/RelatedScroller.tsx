import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import type { RelatedMedia } from "@/lib/media-types";
import { seasonNumber, partNumber } from "@/lib/franchise";
import { SafeImage } from "./SafeImage";

/**
 * Compact season/installment marker derived from the title (e.g. "Saison 2",
 * "Part 2"). Returns null when no confident signal exists so we never invent
 * an order or mislabel a one-off entry.
 */
function seasonMarker(it: RelatedMedia): string | null {
  const s = seasonNumber(it.title);
  if (s != null) return `S${s}`;
  const p = partNumber(it.title);
  if (p != null) return `P${p}`;
  return null;
}

/**
 * For linked works with no internal KAZEN fiche (manga, light novels, OST…),
 * derive a safe outbound AniList reference so the item is still explorable
 * instead of being a dead card. Returns null for non-AniList sources so we
 * never expose a fabricated link.
 */
function externalRefUrl(it: RelatedMedia): string | null {
  if (it.source !== "anilist" || !/^\d+$/.test(it.externalId)) return null;
  const isManga =
    it.formatGroup === "manga" || it.formatGroup === "novel";
  return `https://anilist.co/${isManga ? "manga" : "anime"}/${it.externalId}`;
}

function Poster({ it }: { it: RelatedMedia }) {
  return (
    <>
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
    </>
  );
}

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
        {items.map((it) => {
          // Any real AniList id (anime OR manga/LN) now resolves to an internal
          // KAZEN fiche via the universal detail query + browser-direct
          // fallback, so we link internally instead of bouncing to AniList.
          // Non-AniList items honour their hasDetail flag; a real-id fallback
          // keeps the card explorable rather than a dead "introuvable".
          const anilistReal = it.source === "anilist" && /^\d+$/.test(it.externalId);
          const clickable = anilistReal || it.hasDetail !== false;
          const external = clickable ? null : externalRefUrl(it);
          const inner: ReactNode = <Poster it={it} />;
          return (
            <li key={it.key} className="w-32 shrink-0 snap-start">
              {clickable ? (
                <Link
                  to="/media/$source/$id"
                  params={{ source: it.source, id: it.externalId }}
                  className="group block focus-visible:outline-none"
                >
                  {inner}
                </Link>
              ) : external ? (
                <a
                  href={external}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block focus-visible:outline-none"
                >
                  <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-background/80 p-1 text-muted-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                    <ArrowUpRight className="h-3 w-3" />
                  </span>
                  {inner}
                </a>
              ) : (
                <div className="group block cursor-default">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>

    </section>
  );
}
