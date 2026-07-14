import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Bookmark, BookmarkCheck, CheckCircle2, Heart, Plus, RotateCcw, Star, Tag, X } from "lucide-react";
import type { MediaItem, PriorityLevel, WatchStatus } from "@/lib/media-types";
import { PRIORITY_LABELS, WATCH_STATUS_LABELS } from "@/lib/media-types";
import { useAuth } from "@/lib/auth";
import { useListMutations, useUserEntry } from "@/lib/use-list";
import {
  applyTrackingRules,
  atFinalEpisode,
  completePatch,
  effectiveMax,
  needsReconciliation,
  rewatchPatch,
  toTrackingState,
} from "@/lib/tracking";
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
import { Link } from "@tanstack/react-router";

const STATUSES: WatchStatus[] = ["a_voir", "en_cours", "termine", "en_pause", "abandonne"];
const PRIORITIES: PriorityLevel[] = ["basse", "normale", "haute"];

// timestamptz <-> <input type="date"> (yyyy-mm-dd) helpers.
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}
function fromDateInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function ListControls({ item }: { item: MediaItem }) {
  const { user, ready } = useAuth();
  const entry = useUserEntry(item.key);
  const { upsert, remove } = useListMutations();
  const [tagDraft, setTagDraft] = useState("");
  const [progressWarn, setProgressWarn] = useState(false);
  const [noteDraft, setNoteDraft] = useState(entry?.notes ?? "");

  useEffect(() => {
    setNoteDraft(entry?.notes ?? "");
  }, [entry?.notes]);

  if (!ready) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Ma liste</h2>
          <span className="h-2 w-2 rounded-full bg-primary/70" aria-hidden="true" />
        </div>
        <div className="h-10 animate-pulse rounded-xl bg-muted/40" aria-label="Chargement de votre espace membre" />
      </div>
    );
  }

  if (ready && !user) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 text-center backdrop-blur">
        <h2 className="font-display text-lg font-bold">Ma liste</h2>
        <p className="text-sm text-muted-foreground">
          Connectez-vous pour suivre ce titre, noter et organiser vos listes.
        </p>
        <Button asChild variant="aurora" className="w-full">
          <Link to="/auth" search={{ redirect: undefined }}>
            Se connecter
          </Link>
        </Button>
      </div>
    );
  }

  const inList = Boolean(entry);
  const trackState = toTrackingState(entry);
  const max = effectiveMax(item.mediaType, item.episodesCount);
  const showReconcile = needsReconciliation(entry?.progress ?? null, max);
  const canComplete = atFinalEpisode(trackState, max);

  // All tracking-relevant mutations flow through the shared rules helper so the
  // fiche panel and the "Ma liste" editor apply identical business logic.
  const patch = (
    p: Parameters<typeof upsert.mutate>[0]["patch"],
    confirm?: string,
  ) => {
    upsert.mutate({ item, patch: applyTrackingRules(trackState, max, p) });
    if (confirm) toast.success(confirm);
  };

  const addTag = () => {
    const v = tagDraft.trim();
    if (!v) return;
    patch({ tags: Array.from(new Set([...(entry?.tags ?? []), v])) }, "Tag ajouté");
    setTagDraft("");
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Ma liste</h2>
        {inList ? (
          <button
            type="button"
            onClick={() => remove.mutate(item.key)}
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
          disabled={upsert.isPending}
          onClick={() => patch({ status: "a_voir" }, "Ajouté à votre liste")}
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
                onClick={() => patch({ status: active ? null : s }, active ? undefined : "Statut mis à jour")}
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

      {/* Progression & suivi */}
      <div className="space-y-3 rounded-xl border border-border/60 bg-background/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Progression & suivi
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="progress" className="text-xs font-medium text-muted-foreground">
            {item.mediaType === "movie" ? "Vu (0/1)" : "Épisodes vus"}
          </label>
          <Input
            id="progress"
            type="number"
            min={0}
            max={max ?? undefined}
            step={1}
            inputMode="numeric"
            value={entry?.progress ?? ""}
            aria-describedby={progressWarn ? "progress-warn" : undefined}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === "") {
                setProgressWarn(false);
                patch({ progress: null });
                return;
              }
              const raw = Math.max(0, parseInt(v, 10) || 0);
              setProgressWarn(max != null && raw > max);
              // applyTrackingRules re-clamps server-side; keep the stored value ≤ max.
              patch({ progress: max != null ? Math.min(raw, max) : raw });
            }}
            className="h-8 w-20"
            aria-label="Progression"
          />
          {item.mediaType !== "movie" && max != null ? (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              / {max} ép.
            </span>
          ) : null}
        </div>

        {progressWarn && max != null ? (
          <p id="progress-warn" role="alert" className="text-xs text-amber-300">
            Maximum {max}{item.mediaType === "movie" ? "" : " ép."} pour ce titre — la valeur a été ramenée à {max}.
          </p>
        ) : null}


        {showReconcile ? (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-300">
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Votre progression enregistrée ({entry?.progress}) dépasse le total connu
                ({max} ép.). Aucune valeur n'a été modifiée.
              </span>
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 self-start text-xs"
              disabled={upsert.isPending}
              onClick={() => patch({ progress: max }, "Progression ajustée")}
            >
              Ajuster à {max} ép.
            </Button>
          </div>
        ) : null}

        {canComplete ? (
          <Button
            type="button"
            size="sm"
            variant="aurora"
            className="h-8 w-full gap-1.5 text-xs"
            disabled={upsert.isPending}
            onClick={() => patch(completePatch(), "Marqué comme terminé")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Marquer comme terminé
          </Button>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor="started" className="text-xs font-medium text-muted-foreground">
              Commencé le
            </label>
            <Input
              id="started"
              type="date"
              value={toDateInput(entry?.startedAt ?? null)}
              onChange={(e) => patch({ started_at: fromDateInput(e.target.value) })}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="completed" className="text-xs font-medium text-muted-foreground">
              Terminé le
            </label>
            <Input
              id="completed"
              type="date"
              value={toDateInput(entry?.completedAt ?? null)}
              onChange={(e) => patch({ completed_at: fromDateInput(e.target.value) })}
              className="h-8"
            />
          </div>
        </div>
        {inList ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 w-full gap-1.5 text-xs"
            disabled={upsert.isPending}
            onClick={() => {
              // Explicit rewatch: increments the count exactly once and resets
              // progress, preserving historical completion/start dates. Disabled
              // while pending guards against duplicate submissions.
              upsert.mutate(
                { item, patch: rewatchPatch(trackState) },
                { onSuccess: () => toast.success("Nouveau visionnage lancé") },
              );
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Recommencer
          </Button>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={entry?.isRewatching ?? false}
            onClick={() => patch({ is_rewatching: !(entry?.isRewatching ?? false) })}
            className={cn(
              "focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              entry?.isRewatching
                ? "border-transparent bg-primary/15 text-primary"
                : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Revisionnage
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Fois revu</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={entry?.rewatchCount ?? 0}
              onChange={(e) =>
                patch({ rewatch_count: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className="h-8 w-16"
              aria-label="Nombre de revisionnages"
            />
          </div>
        </div>
      </div>


      {/* Note perso */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ma note</p>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = (entry?.rating ?? 0) >= n;
            return (
              <button
                key={n}
                type="button"
                aria-label={`Noter ${n} sur 10`}
                onClick={() => patch({ rating: entry?.rating === n ? null : n }, entry?.rating === n ? undefined : "Note enregistrée")}
                className="focus-ring rounded p-0.5"
              >
                <Star
                  className={cn(
                    "h-4 w-4 transition-colors",
                    active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
                  )}
                />
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
          onClick={() => patch({ favorite: !(entry?.favorite ?? false) })}
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
            onValueChange={(v) => patch({ priority: v as PriorityLevel })}
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
                  onClick={() => patch({ tags: entry.tags.filter((x) => x !== t) })}
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
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            if (noteDraft !== (entry?.notes ?? "")) patch({ notes: noteDraft }, "Note enregistrée");
          }}
          placeholder="Vos impressions, où vous en êtes…"
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
}
