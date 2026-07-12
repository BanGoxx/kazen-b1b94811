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

const TYPES: MediaRequestType[] = ["anime", "series", "film"];

/**
 * Restrained "Proposer ce titre" flow. Members can request a missing title;
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
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [mediaType, setMediaType] = useState<MediaRequestType>("anime");
  const [externalUrl, setExternalUrl] = useState("");
  const [note, setNote] = useState("");
  const { submit } = useMediaRequestMutations();

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Indiquez le titre à proposer.");
      return;
    }
    try {
      await submit.mutateAsync({ title, mediaType, externalUrl, note });
      toast.success("Proposition envoyée. Merci ! L'équipe KAZEN l'examinera.");
      setOpen(false);
      setTitle("");
      setExternalUrl("");
      setNote("");
    } catch {
      toast.error("Impossible d'envoyer la proposition pour le moment.");
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
            <Sparkles className="h-4 w-4" /> Proposer ce titre
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Proposer un titre manquant</DialogTitle>
          <DialogDescription>
            Ce titre n'est pas encore dans KAZEN ? Proposez-le. L'équipe KAZEN l'examinera — cela ne
            crée pas de fiche automatiquement.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre du média"
            maxLength={200}
          />
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMediaType(t)}
                className={cn(
                  "focus-ring rounded-full border px-3 py-1 text-sm transition-colors",
                  mediaType === t
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {MEDIA_REQUEST_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <Input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="Lien externe (optionnel) — ex. AniList, TMDB…"
            maxLength={500}
          />
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Pourquoi ce titre ? (optionnel)"
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
            Envoyer la proposition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
