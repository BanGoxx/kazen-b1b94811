import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MessageSquare, Star, Pencil, Trash2, LogIn, Heart, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useFicheReviews,
  useMyReview,
  useReviewMutations,
  useReviewLikes,
  useReviewLikeToggle,
  useReviewReplies,
  useReplyMutations,
  useReplyLikes,
  useReplyLikeToggle,
} from "@/lib/reviews";
import type { FicheReview, ReviewReply } from "@/lib/reviews";
import { FicheSection } from "@/components/media/FicheSection";
import { ExpandableText } from "@/components/media/ExpandableText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const BODY_MAX = 4000;
const REPLY_MAX = 1500;

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

function LikeButton({
  count,
  liked,
  disabled,
  onToggle,
  small,
}: {
  count: number;
  liked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={liked}
      aria-label={liked ? "Retirer mon j'aime" : "Aimer"}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors disabled:opacity-50",
        small ? "text-xs" : "text-sm",
        liked
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
      )}
    >
      <Heart className={cn(small ? "h-3.5 w-3.5" : "h-4 w-4", liked && "fill-primary")} />
      <span className="font-medium tabular-nums">{count}</span>
    </button>
  );
}

function ReplyItem({
  reply,
  currentUserId,
}: {
  reply: ReviewReply;
  currentUserId: string | null;
}) {
  const isOwn = reply.userId === currentUserId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.body);
  const { update, remove } = useReplyMutations(reply.reviewId);
  const { count, likedByMe } = useReplyLikes(reply.id);
  const toggle = useReplyLikeToggle(reply.id);

  const handleLike = () => {
    if (!currentUserId) {
      toast.error("Connectez-vous pour aimer une réponse.");
      return;
    }
    toggle.mutate(likedByMe);
  };

  const saveEdit = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      await update.mutateAsync({ id: reply.id, body: text });
      setEditing(false);
    } catch {
      toast.error("Impossible d'enregistrer. Réessayez.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Supprimer cette réponse ?")) return;
    try {
      await remove.mutateAsync(reply.id);
      toast.success("Réponse supprimée.");
    } catch {
      toast.error("Impossible de supprimer. Réessayez.");
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-2">
        <Avatar className="h-7 w-7">
          {reply.authorAvatar && <AvatarImage src={reply.authorAvatar} alt="" />}
          <AvatarFallback className="bg-muted text-[10px]">
            {initials(reply.authorName)}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-semibold text-foreground">
          {reply.authorName}
          {isOwn && <span className="ml-1.5 text-[10px] font-medium text-primary">Vous</span>}
        </span>
        <span className="text-[11px] text-muted-foreground">{formatDate(reply.createdAt)}</span>
      </div>
      {editing ? (
        <div className="mt-2">
          <Textarea
            value={draft}
            maxLength={REPLY_MAX}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            className="resize-y text-sm"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Annuler
            </Button>
            <Button variant="aurora" size="sm" onClick={saveEdit} disabled={update.isPending}>
              Enregistrer
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{reply.body}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <LikeButton small count={count} liked={likedByMe} disabled={toggle.isPending} onToggle={handleLike} />
        <div className="flex items-center gap-1">
          {isOwn && !editing && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-3 w-3" /> Modifier
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 className="mr-1 h-3 w-3" /> Supprimer
              </Button>
            </>
          )}
          {!isOwn && currentUserId && (
            <ReportDialog targetType="reply" targetId={reply.id} label="Signaler" />
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewItem({
  review,
  currentUserId,
  onEdit,
  onDelete,
}: {
  review: FicheReview;
  currentUserId: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const isOwn = review.userId === currentUserId;
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const { count: likeCount, likedByMe } = useReviewLikes(review.id);
  const likeToggle = useReviewLikeToggle(review.id);
  const { data: replies = [] } = useReviewReplies(review.id);
  const { add } = useReplyMutations(review.id);

  const handleLike = () => {
    if (!currentUserId) {
      toast.error("Connectez-vous pour aimer un avis.");
      return;
    }
    likeToggle.mutate(likedByMe);
  };

  const submitReply = async () => {
    const text = replyDraft.trim();
    if (!text) return;
    if (!currentUserId) {
      toast.error("Connectez-vous pour répondre.");
      return;
    }
    try {
      await add.mutateAsync(text);
      setReplyDraft("");
      setShowReplyBox(false);
    } catch {
      toast.error("Impossible d'envoyer la réponse. Réessayez.");
    }
  };

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
        <ExpandableText text={review.body} limit={320} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <LikeButton count={likeCount} liked={likedByMe} disabled={likeToggle.isPending} onToggle={handleLike} />
        <button
          type="button"
          onClick={() => setShowReplyBox((v) => !v)}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium tabular-nums">{replies.length}</span>
          <span>Répondre</span>
        </button>
        {isOwn ? (
          <div className="ml-auto flex items-center gap-1">
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Modifier
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Supprimer
              </Button>
            )}
          </div>
        ) : (
          currentUserId && (
            <div className="ml-auto">
              <ReportDialog targetType="review" targetId={review.id} label="Signaler" />
            </div>
          )
        )}
      </div>

      {showReplyBox && (
        <div className="mt-3">
          {currentUserId ? (
            <>
              <Textarea
                value={replyDraft}
                maxLength={REPLY_MAX}
                rows={3}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="Votre réponse…"
                className="resize-y text-sm"
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowReplyBox(false)}>
                  Annuler
                </Button>
                <Button variant="aurora" size="sm" onClick={submitReply} disabled={add.isPending}>
                  {add.isPending ? "Envoi…" : "Répondre"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connectez-vous pour répondre à cet avis.
            </p>
          )}
        </div>
      )}

      {replies.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-border/60 pl-3">
          {replies.map((r) => (
            <ReplyItem key={r.id} reply={r} currentUserId={currentUserId} />
          ))}
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

  useEffect(() => {
    if (myReview) setEditing(false);
  }, [myReview]);

  const others = reviews.filter((r) => r.userId !== user?.id);
  const count = reviews.length;
  const currentUserId = user?.id ?? null;

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
            currentUserId={currentUserId}
            onEdit={() => setEditing(true)}
            onDelete={handleDelete}
          />
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement des avis…</p>
        ) : others.length > 0 ? (
          <div className="space-y-3">
            {others.map((r) => (
              <ReviewItem key={r.id} review={r} currentUserId={currentUserId} />
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
