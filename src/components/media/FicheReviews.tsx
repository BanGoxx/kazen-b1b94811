import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MessageSquare, Star, Pencil, Trash2, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useFicheReviews, useMyReview, useReviewMutations } from "@/lib/reviews";
import type { FicheReview } from "@/lib/reviews";
import { FicheSection } from "@/components/media/FicheSection";
import { ExpandableText } from "@/components/media/ExpandableText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const BODY_MAX = 4000;

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function RatingStars({ value }: { value: number }) {
  // value is out of 10; render 5 stars.
  const filled = Math.round(value / 2);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Note ${value}/10`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < filled ? "fill-primary text-primary" : "text-muted-foreground/40",
          )}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-foreground">{value}/10</span>
    </span>
  );
}

function ReviewEditor({
  source,
  externalId,
  existing,
  onDone,
}: {
  source: string;
  externalId: string;
  existing: FicheReview | null;
  onDone: () => void;
}) {
  const [body, setBody] = useState(existing?.body ?? "");
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const { upsert } = useReviewMutations(source, externalId);

  const submit = async () => {
    const text = body.trim();
    if (text.length === 0) {
      toast.error("Votre avis ne peut pas être vide.");
      return;
    }
    try {
      await upsert.mutateAsync({ body: text, rating });
      toast.success(existing ? "Avis mis à jour." : "Avis publié. Merci !");
      onDone();
    } catch {
      toast.error("Impossible d'enregistrer votre avis. Réessayez.");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Votre note :</span>
        <div className="flex items-center gap-1">
          {Array.from({ length: 10 }).map((_, i) => {
            const val = i + 1;
            return (
              <button
                key={val}
                type="button"
                onClick={() => setRating(rating === val ? null : val)}
                aria-label={`Attribuer la note ${val} sur 10`}
                aria-pressed={rating === val}
                className={cn(
                  "focus-ring rounded transition-transform hover:scale-110",
                  rating !== null && val <= rating ? "text-primary" : "text-muted-foreground/40",
                )}
              >
                <Star className={cn("h-5 w-5", rating !== null && val <= rating && "fill-primary")} />
              </button>
            );
          })}
        </div>
        {rating !== null && (
          <span className="text-sm font-semibold text-foreground">{rating}/10</span>
        )}
      </div>
      <Textarea
        value={body}
        maxLength={BODY_MAX}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Partagez votre avis sur ce titre (sans spoilers si possible)…"
        rows={4}
        className="resize-y"
      />
      <div className="mt-1 text-right text-xs text-muted-foreground">
        {body.length}/{BODY_MAX}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {existing && (
          <Button variant="ghost" onClick={onDone} disabled={upsert.isPending}>
            Annuler
          </Button>
        )}
        <Button variant="aurora" onClick={submit} disabled={upsert.isPending}>
          {upsert.isPending ? "Envoi…" : existing ? "Mettre à jour" : "Publier mon avis"}
        </Button>
      </div>
    </div>
  );
}

function ReviewItem({
  review,
  isOwn,
  onEdit,
  onDelete,
}: {
  review: FicheReview;
  isOwn: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card/40 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {review.authorAvatar && <AvatarImage src={review.authorAvatar} alt="" />}
            <AvatarFallback className="bg-muted text-xs">
              {initials(review.authorName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {review.authorName}
              {isOwn && <span className="ml-2 text-xs font-medium text-primary">Vous</span>}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</p>
          </div>
        </div>
        {review.rating !== null && <RatingStars value={review.rating} />}
      </header>
      <div className="mt-3">
        <ExpandableText text={review.body} clampLines={5} />
      </div>
      {isOwn && (
        <div className="mt-3 flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Modifier
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Supprimer
          </Button>
        </div>
      )}
    </article>
  );
}

export function FicheReviews({
  source,
  externalId,
}: {
  source: string;
  externalId: string;
}) {
  const { user, ready } = useAuth();
  const { data: reviews = [], isLoading } = useFicheReviews(source, externalId);
  const myReview = useMyReview(source, externalId);
  const { remove } = useReviewMutations(source, externalId);
  const [editing, setEditing] = useState(false);

  // Close the editor automatically once a fresh review appears for this user.
  useEffect(() => {
    if (myReview) setEditing(false);
  }, [myReview]);

  const others = reviews.filter((r) => r.userId !== user?.id);
  const count = reviews.length;

  const handleDelete = async () => {
    if (!window.confirm("Supprimer votre avis ?")) return;
    try {
      await remove.mutateAsync();
      toast.success("Avis supprimé.");
    } catch {
      toast.error("Impossible de supprimer. Réessayez.");
    }
  };

  return (
    <FicheSection
      title={`Avis de la communauté${count > 0 ? ` (${count})` : ""}`}
      icon={<MessageSquare className="h-5 w-5" />}
    >
      <div className="space-y-4">
        {/* Composer / own review */}
        {ready && !user && (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Connectez-vous pour partager votre avis et votre note.
            </p>
            <Button asChild variant="aurora" size="sm">
              <Link to="/auth" search={{ redirect: undefined }}>
                <LogIn className="mr-1 h-4 w-4" /> Se connecter
              </Link>
            </Button>
          </div>
        )}

        {user && (editing || !myReview) && (
          <ReviewEditor
            source={source}
            externalId={externalId}
            existing={editing ? myReview : null}
            onDone={() => setEditing(false)}
          />
        )}

        {user && myReview && !editing && (
          <ReviewItem
            review={myReview}
            isOwn
            onEdit={() => setEditing(true)}
            onDelete={handleDelete}
          />
        )}

        {/* Other members' reviews */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement des avis…</p>
        ) : others.length > 0 ? (
          <div className="space-y-3">
            {others.map((r) => (
              <ReviewItem key={r.id} review={r} isOwn={false} onEdit={() => {}} onDelete={() => {}} />
            ))}
          </div>
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun avis pour le moment. {user ? "Soyez le premier à en publier un !" : ""}
          </p>
        ) : null}
      </div>
    </FicheSection>
  );
}
