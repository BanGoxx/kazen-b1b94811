import { Link } from "@tanstack/react-router";
import { Heart, ListMusic, ArrowRight } from "lucide-react";
import { usePublicPlaylists } from "@/lib/playlists";
import { SafeImage } from "@/components/media/SafeImage";

/**
 * Calm Découverte module surfacing popular community shared lists. Renders only
 * when real public lists exist, so the main discovery content stays dominant.
 */
export function CommunityListsBand() {
  const { data, isLoading } = usePublicPlaylists();
  const lists = (data?.popular?.length ? data.popular : data?.recent ?? []).slice(0, 4);

  if (isLoading || lists.length === 0) return null;

  return (
    <section aria-labelledby="community-lists-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h2
            id="community-lists-heading"
            className="flex items-center gap-2 text-lg font-bold text-foreground"
          >
            <ListMusic className="h-5 w-5 text-primary" /> Collections de la communauté
          </h2>
          <p className="text-sm text-muted-foreground">
            Des sélections d'anime, séries et films curées par les membres KAZEN.
          </p>
        </div>
        <Link
          to="/listes"
          className="focus-ring inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Tout voir <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {lists.map((list) => (
          <Link
            key={list.id}
            to="/playlist/$id"
            params={{ id: list.id }}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card/50 p-3.5 backdrop-blur transition-colors hover:border-primary/50 hover:bg-card/70"
          >
            {list.posters.length > 0 ? (
              <div className="flex gap-1.5">
                {list.posters.slice(0, 3).map((p, i) => (
                  <SafeImage
                    key={i}
                    src={p}
                    alt=""
                    className="h-20 w-full flex-1 rounded-lg object-cover ring-1 ring-border"
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-20 items-center justify-center rounded-lg bg-muted/40">
                <ListMusic className="h-5 w-5 text-muted-foreground/60" />
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <h3 className="line-clamp-1 text-sm font-semibold text-foreground group-hover:text-primary">
                {list.title}
              </h3>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{list.ownerName}</span>
                <span className="flex items-center gap-2">
                  <span>
                    {list.count} titre{list.count > 1 ? "s" : ""}
                  </span>
                  {list.likeCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-primary">
                      <Heart className="h-3 w-3 fill-current" /> {list.likeCount}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
