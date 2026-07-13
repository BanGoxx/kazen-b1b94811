import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MessageSquareText, Star, Pencil, Trash2, EyeOff, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportDialog } from "@/components/moderation/ReportDialog";
import { useAuth } from "@/lib/auth";
import { useIsModerator } from "@/lib/use-moderator";
import {
  usePlaylistReviews,
  useMyPlaylistReview,
  usePlaylistReviewMutations,
  PLAYLIST_REVIEWS_PAGE,
  type PlaylistReview,
} from "@/lib/playlist-reviews";

const BODY_MAX = 4000;
const NO_RATING = "none";

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * KAZEN — Avis des membres sur une liste partagée.
 * Rendu uniquement sur les listes publiques. Un membre connecté peut publier
 * un seul avis (modifiable) ; l'écriture passe par des fonctions serveur
 * sécurisées. Lecture publique via RLS.
 */
export function PlaylistReviews({
  playlistId,
  isPublic,
}: {
  playlistId: string;
  isPublic: boolean;
}) {
  const { user } = useAuth();
  const { isModerator } = useModerator();
  const { data, isLoading } = usePlaylistReviews(playlistId);
  const mine = useMyPlaylistReview(playlistId);
  const { upsert, remove } = usePlaylistReviewMutations(playlistId);

  const [visible, setVisible] = useState(PLAYLIST_REVIEWS_PAGE);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<string>(NO_RATING);

  // Public lists only host public reviews.
  if (!isPublic) return null;

  const reviews = data ?? [];
  const others = reviews.filter((r) => r.authorId !== user?.id);
  const shown = others.slice(0, visible);

  const startEdit = () => {
    setBody(mine?.body ?? "");
    setRating(mine?.rating != null ? String(mine.rating) : NO_RATING);
    setEditing(true);
  };

  const submit = async () => {
    const trimmed = body.trim();
    if (trimmed.length < 1) {
      toast.error("Votre avis est vide.");
      return;
    }
    try {
      await upsert.mutateAsync({
        body: trimmed,
        rating: rating === NO_RATING ? null : Number(rating),
      });
      toast.success(mine ? "Avis mis à jour." : "Avis publié.");
      setEditing(false);
    } catch {
      toast.error("Impossible d'enregistrer votre avis.");
    }
  };

  const del = async () => {
    try {
      await remove.mutateAsync(mine!.id);
      toast.success("Avis supprimé.");
    } catch {
      toast.error("Impossible de supprimer votre avis.");
    }
  };

  return (
    <section aria-labelledby="pl-reviews-title" className="space-y-5">
      <div className="flex items-center justify-between">
        <h2
          id="pl-reviews-title"
          className="flex items-center gap-2 text-lg font-bold text-foreground"
        >
          <MessageSquareText className="h-5 w-5 text-primary" />
          Avis des membres
          {reviews.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({reviews.length})
            </span>
          )}
        </h2>
      </div>

      {/* Form / own review area */}
      {user ? (
        editing ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card/50 p-4">
            <Textarea
              value={body}
              maxLength={BODY_MAX}
              rows={4}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Partagez votre avis sur cette liste…"
              className="resize-y text-sm"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Note</span>
                <Select value={rating} onValueChange={setRating}>
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_RATING}>Aucune</SelectItem>
                    {Array.from({ length: 11 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i}/10
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">
                  {body.length}/{BODY_MAX}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={upsert.isPending}
                >
                  Annuler
                </Button>
                <Button
                  variant="aurora"
                  size="sm"
                  onClick={submit}
                  disabled={upsert.isPending}
                >
                  {upsert.isPending ? "Enregistrement…" : mine ? "Mettre à jour" : "Publier"}
                </Button>
              </div>
            </div>
          </div>
        ) : mine ? (
          <ReviewCard
            review={mine}
            isOwn
            onEdit={startEdit}
            onDelete={del}
            deleting={remove.isPending}
          />
        ) : (
          <Button variant="aurora" size="sm" className="gap-1.5" onClick={startEdit}>
            <Pencil className="h-4 w-4" /> Écrire un avis
          </Button>
        )
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
          <Link
            to="/auth"
            search={{ redirect: `/playlist/${playlistId}` }}
            className="font-medium text-primary hover:underline"
          >
            Connectez-vous
          </Link>{" "}
          pour laisser un avis sur cette liste.
        </div>
      )}

      {/* Other members' reviews */}
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Chargement des avis…
        </p>
      ) : others.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {mine
            ? "Aucun autre avis pour le moment."
            : "Aucun avis pour le moment. Soyez le premier !"}
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <ReviewCard key={r.id} review={r} isModerator={isModerator} />
          ))}
          {others.length > visible && (
            <div className="pt-1 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisible((v) => v + PLAYLIST_REVIEWS_PAGE)}
              >
                Voir plus d'avis
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ReviewCard({
  review,
  isOwn = false,
  isModerator = false,
  onEdit,
  onDelete,
  deleting = false,
}: {
  review: PlaylistReview;
  isOwn?: boolean;
  isModerator?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <article className="space-y-2 rounded-2xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            {review.authorAvatar && <AvatarImage src={review.authorAvatar} alt="" />}
            <AvatarFallback className="bg-muted text-[10px]">
              {initials(review.authorName)}
            </AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <p className="text-sm font-medium text-foreground">
              {review.authorName}
              {isOwn && <span className="ml-1 text-xs text-primary">(vous)</span>}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(review.createdAt)}
              {review.editedAt && " · modifié"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {typeof review.rating === "number" && (
            <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-amber-400">
              <Star className="h-3.5 w-3.5 fill-current" /> {review.rating}/10
            </span>
          )}
          {review.hidden && isModerator && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <EyeOff className="h-3 w-3" /> Masqué
            </span>
          )}
        </div>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {review.body}
      </p>

      <div className="flex items-center gap-1 pt-1">
        {isOwn ? (
          <>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Supprimer
            </Button>
          </>
        ) : (
          <ReportDialog targetType="playlist_review" targetId={review.id} label="Signaler" />
        )}
      </div>
    </article>
  );
}
