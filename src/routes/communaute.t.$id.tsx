import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  MessageSquare,
  Lock,
  Pin,
  ChevronLeft,
  ChevronRight,
  Send,
  Reply as ReplyIcon,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { useIsModerator } from "@/lib/use-moderator";
import {
  useTopic,
  useTopicPosts,
  useCreatePost,
  useEditTopic,
  useEditPost,
  useDeleteTopic,
  useDeletePost,
  useIsAuthor,
  type ForumPost,
} from "@/lib/forum";
import {
  AuthorByline,
  ReportButton,
  ModerationMenu,
  SignInToParticipate,
} from "@/components/community/forum-ui";

interface TopicSearch {
  page: number;
}

export const Route = createFileRoute("/communaute/t/$id")({
  validateSearch: (search: Record<string, unknown>): TopicSearch => ({
    page: Math.max(0, Number(search.page) || 0),
  }),
  head: () => ({
    meta: [
      { title: "Discussion — Communauté KAZEN" },
      {
        name: "description",
        content: "Suivez cette discussion de la communauté KAZEN autour de l'anime, des séries et des films.",
      },
    ],
  }),
  component: TopicPage,
});

function PostBody({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
      {text}
    </div>
  );
}

function TopicPage() {
  const { id } = Route.useParams();
  const { page } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canModerate = useIsModerator();

  const { data: topic, isLoading } = useTopic(id);
  const { data: postsPage } = useTopicPosts(id, page);

  const isTopicAuthor = useIsAuthor(topic?.author.id);
  const createPost = useCreatePost(id);
  const editTopic = useEditTopic();
  const editPost = useEditPost(id);
  const deleteTopic = useDeleteTopic();
  const deletePost = useDeletePost(id);

  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<ForumPost | null>(null);
  const [editTopicOpen, setEditTopicOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTopicBody, setEditTopicBody] = useState("");
  const [editingPost, setEditingPost] = useState<ForumPost | null>(null);
  const [editPostBody, setEditPostBody] = useState("");
  const [confirmDeleteTopic, setConfirmDeleteTopic] = useState(false);
  const [confirmDeletePost, setConfirmDeletePost] = useState<ForumPost | null>(null);

  const posts = postsPage?.posts ?? [];
  const pageCount = postsPage?.pageCount ?? 1;
  const locked = topic?.isLocked ?? false;

  function goPage(p: number) {
    navigate({ to: "/communaute/t/$id", params: { id }, search: { page: p } });
  }

  async function submitReply() {
    const body = reply.trim();
    if (!body) return;
    try {
      await createPost.mutateAsync({ body, replyToId: replyTo?.id ?? null });
      setReply("");
      setReplyTo(null);
      toast.success("Réponse publiée");
      if (postsPage && postsPage.total + 1 > (page + 1) * posts.length && pageCount > page + 1) {
        goPage(pageCount - 1);
      }
    } catch (e) {
      toast.error("Impossible de publier", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 pb-16">
        <nav className="text-xs text-muted-foreground">
          <Link to="/communaute" className="hover:text-foreground">
            Communauté
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">Discussion</span>
        </nav>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4 rounded-xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : !topic || topic.deleted ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-20 text-center">
            <p className="text-base font-semibold text-foreground">Discussion indisponible</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ce sujet n'existe pas ou a été retiré.
            </p>
            <Button asChild variant="aurora" size="sm" className="mt-5">
              <Link to="/communaute">Retour à la communauté</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Topic header + opening post */}
            <article className="space-y-4 rounded-2xl border border-border bg-card/50 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-foreground">
                  {topic.isPinned && <Pin className="h-4 w-4 text-primary" />}
                  {topic.hidden && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <EyeOff className="h-3 w-3" /> Masqué
                    </span>
                  )}
                  {topic.title}
                  {locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                </h1>
                <div className="flex shrink-0 items-center">
                  <ReportButton targetType="topic" targetId={topic.id} isAuthenticated={Boolean(user)} />
                  <ModerationMenu
                    targetType="topic"
                    targetId={topic.id}
                    hidden={topic.hidden}
                    deleted={topic.deleted}
                    canModerate={canModerate}
                    isAuthor={isTopicAuthor}
                    onEdit={() => {
                      setEditTitle(topic.title);
                      setEditTopicBody(topic.body);
                      setEditTopicOpen(true);
                    }}
                    onDelete={() => setConfirmDeleteTopic(true)}
                  />
                </div>
              </div>
              <AuthorByline author={topic.author} when={topic.createdAt} edited={topic.updatedAt !== topic.createdAt} size="md" />
              <PostBody text={topic.body} />
            </article>

            {/* Replies */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                {topic.replyCount} réponse{topic.replyCount > 1 ? "s" : ""}
              </h2>

              {posts.map((p) => {
                const isPostAuthor = user && user.id === p.author.id;
                return (
                  <article
                    key={p.id}
                    className="space-y-2 rounded-2xl border border-border/70 bg-card/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <AuthorByline author={p.author} when={p.createdAt} edited={p.updatedAt !== p.createdAt} />
                      <div className="flex shrink-0 items-center">
                        <ReportButton targetType="post" targetId={p.id} isAuthenticated={Boolean(user)} />
                        <ModerationMenu
                          targetType="post"
                          targetId={p.id}
                          hidden={p.hidden}
                          deleted={p.deleted}
                          canModerate={canModerate}
                          isAuthor={Boolean(isPostAuthor)}
                          onEdit={() => {
                            setEditingPost(p);
                            setEditPostBody(p.body);
                          }}
                          onDelete={() => setConfirmDeletePost(p)}
                        />
                      </div>
                    </div>
                    <PostBody text={p.body} />
                    {user && !locked && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(p);
                          document.getElementById("forum-reply")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                      >
                        <ReplyIcon className="h-3.5 w-3.5" /> Répondre
                      </button>
                    )}
                  </article>
                );
              })}

              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => goPage(page - 1)} className="gap-1">
                    <ChevronLeft className="h-4 w-4" /> Précédent
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page + 1} / {pageCount}
                  </span>
                  <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => goPage(page + 1)} className="gap-1">
                    Suivant <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </section>

            {/* Composer */}
            <section id="forum-reply" className="scroll-mt-20">
              {locked ? (
                <div className="rounded-2xl border border-border bg-card/40 px-5 py-4 text-center text-sm text-muted-foreground">
                  <Lock className="mx-auto mb-1 h-4 w-4" />
                  Ce sujet est verrouillé. Les nouvelles réponses sont désactivées.
                </div>
              ) : !user ? (
                <SignInToParticipate label="Vous devez être connecté pour répondre." />
              ) : (
                <div className="space-y-3 rounded-2xl border border-border bg-card/50 p-4">
                  {replyTo && (
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                      <span className="truncate">
                        En réponse à <strong className="text-foreground/80">{replyTo.author.displayName}</strong>
                      </span>
                      <button type="button" onClick={() => setReplyTo(null)} className="hover:text-foreground">
                        Annuler
                      </button>
                    </div>
                  )}
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value.slice(0, 20000))}
                    placeholder="Partagez votre réponse…"
                    rows={4}
                    aria-label="Votre réponse"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{reply.length}/20000</span>
                    <Button
                      variant="aurora"
                      size="sm"
                      className="gap-1.5"
                      disabled={createPost.isPending || reply.trim().length === 0}
                      onClick={submitReply}
                    >
                      <Send className="h-4 w-4" /> Publier
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Edit topic dialog */}
      <Dialog open={editTopicOpen} onOpenChange={setEditTopicOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le sujet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Titre</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value.slice(0, 160))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-body">Message</Label>
              <Textarea id="edit-body" value={editTopicBody} onChange={(e) => setEditTopicBody(e.target.value.slice(0, 20000))} rows={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTopicOpen(false)}>Annuler</Button>
            <Button
              variant="aurora"
              disabled={editTopic.isPending}
              onClick={async () => {
                try {
                  await editTopic.mutateAsync({ id, title: editTitle, body: editTopicBody });
                  toast.success("Sujet modifié");
                  setEditTopicOpen(false);
                } catch (e) {
                  toast.error("Modification impossible", { description: e instanceof Error ? e.message : undefined });
                }
              }}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit post dialog */}
      <Dialog open={Boolean(editingPost)} onOpenChange={(o) => !o && setEditingPost(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la réponse</DialogTitle>
          </DialogHeader>
          <Textarea value={editPostBody} onChange={(e) => setEditPostBody(e.target.value.slice(0, 20000))} rows={6} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPost(null)}>Annuler</Button>
            <Button
              variant="aurora"
              disabled={editPost.isPending}
              onClick={async () => {
                if (!editingPost) return;
                try {
                  await editPost.mutateAsync({ id: editingPost.id, body: editPostBody });
                  toast.success("Réponse modifiée");
                  setEditingPost(null);
                } catch (e) {
                  toast.error("Modification impossible", { description: e instanceof Error ? e.message : undefined });
                }
              }}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete topic */}
      <AlertDialog open={confirmDeleteTopic} onOpenChange={setConfirmDeleteTopic}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce sujet ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le sujet sera retiré de la communauté. Cette action peut être restaurée par la modération.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await deleteTopic.mutateAsync(id);
                  toast.success("Sujet supprimé");
                  navigate({ to: "/communaute" });
                } catch (e) {
                  toast.error("Suppression impossible", { description: e instanceof Error ? e.message : undefined });
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete post */}
      <AlertDialog open={Boolean(confirmDeletePost)} onOpenChange={(o) => !o && setConfirmDeletePost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette réponse ?</AlertDialogTitle>
            <AlertDialogDescription>
              La réponse sera retirée de la discussion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDeletePost) return;
                try {
                  await deletePost.mutateAsync(confirmDeletePost.id);
                  toast.success("Réponse supprimée");
                  setConfirmDeletePost(null);
                } catch (e) {
                  toast.error("Suppression impossible", { description: e instanceof Error ? e.message : undefined });
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
