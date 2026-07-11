import { useState } from "react";
import { Bookmark, BookmarkCheck, Heart, Plus, Tag, X } from "lucide-react";
import type {
  MediaItem,
  PriorityLevel,
  WatchStatus,
} from "@/lib/media-types";
import {
  PRIORITY_LABELS,
  WATCH_STATUS_LABELS,
} from "@/lib/media-types";
import {
  removeEntry,
  setNotes,
  setPriority,
  setStatus,
  setTags,
  toggleFavorite,
  upsertEntry,
  useUserEntry,
} from "@/lib/user-list";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STATUSES: WatchStatus[] = ["a_voir", "en_cours", "termine", "en_pause", "abandonne"];
const PRIORITIES: PriorityLevel[] = ["basse", "normale", "haute"];

export function UserListPanel({ item }: { item: MediaItem }) {
  const entry = useUserEntry(item.key);
  const [tagDraft, setTagDraft] = useState("");
  const inList = Boolean(entry);

  const addTag = () => {
    const v = tagDraft.trim();
    if (!v) return;
    const next = Array.from(new Set([...(entry?.tags ?? []), v]));
    setTags(item, next);
    setTagDraft("");
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Ma liste</h2>
        {inList ? (
          <button
            type="button"
            onClick={() => removeEntry(item.key)}
            className="focus-ring inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" /> Retirer
          </button>
        ) : null}
      </div>

      {!inList ? (
        <Button
          variant="aurora"
          className="w-full gap-2"
          onClick={() => upsertEntry(item, { status: "a_voir" })}
        >
          <Bookmark className="h-4 w-4" /> Ajouter à ma liste
        </Button>
      ) : (
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
          <BookmarkCheck className="h-4 w-4" /> Dans votre liste
        </div>
      )}

      {/* Statut */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => {
            const active = entry?.status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(item, active ? null : s)}
                className={cn(
                  "focus-ring rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "border-transparent aurora-bg text-white"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {WATCH_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Favori + priorité */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-pressed={entry?.favorite ?? false}
          onClick={() => toggleFavorite(item, entry?.favorite ?? false)}
          className={cn(
            "focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            entry?.favorite
              ? "border-transparent bg-rose-500/15 text-rose-400"
              : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", entry?.favorite && "fill-current")} /> Favori
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Priorité</span>
          <Select
            value={entry?.priority ?? "normale"}
            onValueChange={(v) => setPriority(item, v as PriorityLevel)}
          >
            <SelectTrigger className="h-8 w-28" aria-label="Priorité">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Tag className="h-3.5 w-3.5" /> Tags perso
        </p>
        <div className="flex gap-2">
          <Input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Ajouter un tag…"
            className="h-9"
          />
          <Button type="button" size="icon" variant="secondary" className="h-9 w-9 shrink-0" onClick={addTag}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {entry?.tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent-foreground"
              >
                {t}
                <button
                  type="button"
                  aria-label={`Retirer ${t}`}
                  onClick={() => setTags(item, entry.tags.filter((x) => x !== t))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes perso</p>
        <Textarea
          value={entry?.notes ?? ""}
          onChange={(e) => setNotes(item, e.target.value)}
          placeholder="Vos impressions, où vous en êtes…"
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
}
