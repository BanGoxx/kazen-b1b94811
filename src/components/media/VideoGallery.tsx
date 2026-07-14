import { useState } from "react";
import { Play, Youtube } from "lucide-react";
import type { MediaVideo } from "@/lib/media-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConsent } from "@/lib/consent";

interface VideoGalleryProps {
  videos: MediaVideo[];
  title: string;
}

/**
 * Grid of trailers / teasers / clips (TMDB). Each opens in a lightweight modal
 * player. When "contenus externes" consent is off, YouTube thumbnails are NOT
 * fetched (no request to img.youtube.com) — a themed KAZEN placeholder is
 * shown instead, and the user is asked to authorise the video before its
 * iframe is mounted (per-video one-shot allow).
 */
export function VideoGallery({ videos, title }: VideoGalleryProps) {
  const [active, setActive] = useState<MediaVideo | null>(null);
  const [oneShot, setOneShot] = useState<Set<string>>(new Set());
  const { prefs, openPreferences } = useConsent();
  const externalAllowed = prefs.externalMedia;

  if (!videos.length) return null;

  const canPlay = (key: string) => externalAllowed || oneShot.has(key);
  const authoriseOne = (key: string) => setOneShot((prev) => new Set(prev).add(key));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {videos.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => {
              if (!canPlay(v.key)) {
                authoriseOne(v.key);
              }
              setActive(v);
            }}
            className="hover-lift group relative aspect-video overflow-hidden rounded-xl border border-border bg-card/60 text-left transition-colors hover:border-primary/40"
          >
            {externalAllowed ? (
              <img
                src={`https://img.youtube.com/vi/${v.key}/hqdefault.jpg`}
                alt={v.label}
                loading="lazy"
                className="h-full w-full object-cover opacity-80 transition group-hover:scale-105 group-hover:opacity-100"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = "1";
                    img.src = `https://img.youtube.com/vi/${v.key}/mqdefault.jpg`;
                  } else {
                    img.style.display = "none";
                  }
                }}
              />
            ) : (
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/60 to-background/80 text-muted-foreground"
              >
                <Youtube className="h-8 w-8 opacity-70" />
              </span>
            )}

            <span className="absolute inset-0 flex items-center justify-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/90 text-primary-foreground shadow-lg transition group-hover:scale-110">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-background/90 to-transparent px-2 py-1 text-xs font-medium">
              {v.label}
            </span>
          </button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>
              {title} — {active?.label}
            </DialogTitle>
          </DialogHeader>
          {active ? (
            <div className="aspect-video w-full">
              {canPlay(active.key) ? (
                <iframe
                  src={`${active.url.replace("youtube.com", "youtube-nocookie.com")}?autoplay=1`}
                  title={active.label}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : (
                <ExternalConsentPlaceholder
                  onAuthoriseOnce={() => authoriseOne(active.key)}
                  onOpenPreferences={openPreferences}
                />
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExternalConsentPlaceholder({
  onAuthoriseOnce,
  onOpenPreferences,
}: {
  onAuthoriseOnce: () => void;
  onOpenPreferences: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/40 px-6 text-center">
      <Youtube className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        Cette vidéo est hébergée par YouTube. Pour la lire, autorisez les
        contenus externes ou lancez uniquement cette vidéo.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="aurora" onClick={onAuthoriseOnce}>
          Lire cette vidéo
        </Button>
        <Button size="sm" variant="outline" onClick={onOpenPreferences}>
          Gérer mes préférences
        </Button>
      </div>
    </div>
  );
}
