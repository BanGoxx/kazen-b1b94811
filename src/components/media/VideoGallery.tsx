import { useState } from "react";
import { Play } from "lucide-react";
import type { MediaVideo } from "@/lib/media-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VideoGalleryProps {
  videos: MediaVideo[];
  title: string;
}

/**
 * Grid of trailers / teasers / clips (TMDB). Each opens in a lightweight modal
 * player — richer than a single trailer button, still clean and unobtrusive.
 */
export function VideoGallery({ videos, title }: VideoGalleryProps) {
  const [active, setActive] = useState<MediaVideo | null>(null);
  if (!videos.length) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {videos.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setActive(v)}
            className="hover-lift group relative aspect-video overflow-hidden rounded-xl border border-border bg-card/60 text-left transition-colors hover:border-primary/40"
          >
            <img
              src={`https://img.youtube.com/vi/${v.key}/hqdefault.jpg`}
              alt={v.label}
              loading="lazy"
              className="h-full w-full object-cover opacity-80 transition group-hover:scale-105 group-hover:opacity-100"
            />
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
              <iframe
                src={`${active.url}?autoplay=1`}
                title={active.label}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
