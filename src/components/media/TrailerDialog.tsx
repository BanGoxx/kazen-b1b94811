import { useState } from "react";
import { Play, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useConsent } from "@/lib/consent";
import { useI18n } from "@/lib/i18n";

export function TrailerDialog({ url, title }: { url: string; title: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [oneShot, setOneShot] = useState(false);
  const { prefs, openPreferences } = useConsent();
  const canPlay = prefs.externalMedia || oneShot;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setOneShot(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="premium" size="lg" className="gap-2">
          <Play className="h-4 w-4 fill-current" /> {t.fiche.trailerCta}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full">
          {open ? (
            canPlay ? (
              <iframe
                src={`${url.replace("youtube.com", "youtube-nocookie.com")}?autoplay=1`}
                title={t.fiche.trailerIframeTitle.replace("{title}", title)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/40 px-6 text-center">
                <Youtube className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {t.fiche.trailerYouTubeBody}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" variant="aurora" onClick={() => setOneShot(true)}>
                    {t.fiche.trailerPlayOnce}
                  </Button>
                  <Button size="sm" variant="outline" onClick={openPreferences}>
                    {t.fiche.trailerManagePrefs}
                  </Button>
                </div>
              </div>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
