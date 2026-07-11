import { useMemo, useRef, useState } from "react";
import { Sparkles, Send, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaCard } from "./MediaCard";
import { EmptyState } from "./EmptyState";
import { useCandidatePool, useTasteProfile } from "@/lib/use-recommendations";
import { runAssistant, describeIntent, type AssistantResult } from "@/lib/assistant";

const SUGGESTIONS = [
  "un anime horreur",
  "film récent bien noté",
  "série science-fiction",
  "comédie romantique",
  "aventure fantastique populaire",
  "anime action récent",
];

export function RecommendationAssistant({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AssistantResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { pool, isLoading } = useCandidatePool();
  const profile = useTasteProfile();

  const ready = useMemo(() => pool.length > 0, [pool]);

  function ask(query: string) {
    const q = query.trim();
    if (!q || !ready) return;
    setResult(runAssistant(q, pool, profile, 12));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setTimeout(() => inputRef.current?.focus(), 50); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" className="gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Assistant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Que veux-tu regarder&nbsp;?
          </DialogTitle>
          <DialogDescription>
            Décris une envie — genre, type, ambiance — et je te propose les titres les plus pertinents.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ex. un anime horreur récent"
            aria-label="Décris ce que tu veux regarder"
          />
          <Button type="submit" disabled={!ready || !input.trim()} className="gap-2 shrink-0">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Trouver</span>
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setInput(s); ask(s); }}
              className="focus-ring rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="max-h-[52vh] overflow-y-auto">
          {isLoading && !ready ? (
            <EmptyState message="Préparation des recommandations…" />
          ) : result ? (
            result.items.length ? (
              <div>
                <p className="mb-3 text-sm text-muted-foreground">
                  Sélection pour&nbsp;: <span className="text-foreground">{describeIntent(result.intent)}</span>
                </p>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {result.items.map((item) => (
                    <MediaCard key={item.key} item={item} />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                message="Aucun titre ne correspond exactement."
                hint="Essaie une autre formulation, un autre genre ou un autre type."
              />
            )
          ) : (
            <EmptyState
              message="Pose ta question pour commencer."
              hint="Astuce : combine type + genre + ambiance, ex. « série thriller récente »."
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
