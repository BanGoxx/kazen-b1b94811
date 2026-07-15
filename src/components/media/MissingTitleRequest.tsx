import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useMediaRequestMutations,
  MEDIA_REQUEST_TYPE_LABELS,
  type MediaRequestType,
} from "@/lib/media-requests";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const TYPES: MediaRequestType[] = ["anime", "series", "film"];

/**
 * Restrained "suggest this title" flow. Members can request a missing title;
 * during beta only the Owner reviews these (see /moderation). It never creates
 * an official media fiche directly.
 */
export function MissingTitleRequest({
  defaultTitle = "",
  trigger,
}: {
  defaultTitle?: string;
  trigger?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [mediaType, setMediaType] = useState<MediaRequestType>("anime");
  const [externalUrl, setExternalUrl] = useState("");
  const [note, setNote] = useState("");
  const { submit } = useMediaRequestMutations();

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error(t.mediaRequest.emptyTitle);
      return;
    }
    try {
      await submit.mutateAsync({ title, mediaType, externalUrl, note });
      toast.success(t.mediaRequest.sent);
      setOpen(false);
      setTitle("");
      setExternalUrl("");
      setNote("");
    } catch {
      toast.error(t.mediaRequest.sendFailed);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setTitle(defaultTitle);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Sparkles className="h-4 w-4" /> {t.mediaRequest.cta}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.mediaRequest.dialogTitle}</DialogTitle>
          <DialogDescription>{t.mediaRequest.dialogDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.mediaRequest.titlePlaceholder}
            maxLength={200}
          />
          <div className="flex flex-wrap gap-2">
            {TYPES.map((ty) => (
              <button
                key={ty}
                type="button"
                onClick={() => setMediaType(ty)}
                className={cn(
                  "focus-ring rounded-full border px-3 py-1 text-sm transition-colors",
                  mediaType === ty
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {MEDIA_REQUEST_TYPE_LABELS[ty]}
              </button>
            ))}
          </div>
          <Input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder={t.mediaRequest.urlPlaceholder}
            maxLength={500}
          />
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.mediaRequest.notePlaceholder}
            rows={2}
            maxLength={1000}
            className="resize-y"
          />
        </div>
        <DialogFooter>
          <Button variant="aurora" onClick={handleSubmit} disabled={submit.isPending} className="gap-1.5">
            {submit.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t.mediaRequest.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
