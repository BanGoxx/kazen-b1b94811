import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  MessageCircle,
  Send,
  ShieldOff,
  ShieldCheck,
  Archive,
  ArchiveRestore,
  Check,
  X,
  Pencil,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReportDialog } from "@/components/moderation/ReportDialog";
import { useAuth } from "@/lib/auth";
import {
  useChatInbox,
  useConversation,
  useMessages,
  useChatMutations,
  type InboxConversation,
} from "@/lib/chat";
import { relativeTimeFr } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>): { c?: string } => ({
    c: typeof search.c === "string" ? search.c : undefined,
  }),
  head: () => ({ meta: [{ title: "Messages privés — KAZEN" }] }),
  component: MessagesPage,
});

function initialsOf(name?: string | null) {
  return (name ?? "?").trim().slice(0, 1).toUpperCase() || "?";
}

function InboxRow({
  conv,
  active,
  onOpen,
}: {
  conv: InboxConversation;
  active: boolean;
  onOpen: () => void;
}) {
  const name = conv.other?.display_name ?? "Membre";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
        active ? "bg-sidebar-accent" : "hover:bg-muted/60",
      )}
      aria-current={active ? "true" : undefined}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={conv.other?.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="text-xs">{initialsOf(name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          {conv.isRequestToMe && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-primary">
              Demande
            </span>
          )}
          {(conv.unread || conv.isRequestToMe) && (
            <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Non lu" />
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {conv.iBlocked
            ? "Membre bloqué"
            : conv.status === "pending" && conv.amRequester
              ? "Demande envoyée"
              : conv.preview ?? "Aucun message"}
        </span>
      </span>
    </button>
  );
}

function MessagesPage() {
  const { c } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const inbox = useChatInbox();
  const [limit, setLimit] = useState(30);

  const activeId = c;
  const conv = useConversation(activeId);
  const msgs = useMessages(activeId, limit);
  const {
    sendMut,
    acceptMut,
    declineMut,
    markReadMut,
    archiveMut,
    blockMut,
    editMut,
    deleteMut,
  } = useChatMutations();

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const meta = conv.data ?? null;
  const messages = msgs.data?.messages ?? [];
  const canSend =
    meta &&
    meta.status === "active" &&
    !meta.iBlocked &&
    !meta.otherBlocked;

  // Mark read when opening / when new inbound arrives.
  const lastMsgId = messages.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    if (activeId && meta && !meta.isRequestToMe) {
      markReadMut.mutate(activeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, lastMsgId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastMsgId, activeId]);

  useEffect(() => {
    setLimit(30);
    setDraft("");
    setEditing(null);
  }, [activeId]);

  const openConv = (id: string) => navigate({ to: "/messages", search: { c: id } });
  const closeConv = () => navigate({ to: "/messages", search: { c: undefined } });

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !activeId) return;
    setDraft("");
    await sendMut.mutateAsync({ conversationId: activeId, body });
    markReadMut.mutate(activeId);
  };

  const conversations = inbox.data ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">Messages privés</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conversations privées entre membres. Sois respectueux·se — tu peux bloquer ou signaler à tout moment.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          {/* Inbox list */}
          <aside
            className={cn(
              "card-elevated rounded-2xl p-2",
              activeId && "hidden lg:block",
            )}
          >
            {inbox.isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                Aucune conversation pour l'instant.
              </p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((cv) => (
                  <li key={cv.id}>
                    <InboxRow
                      conv={cv}
                      active={cv.id === activeId}
                      onOpen={() => openConv(cv.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* Thread */}
          <section
            className={cn(
              "card-elevated flex min-h-[32rem] flex-col rounded-2xl",
              !activeId && "hidden lg:flex",
            )}
          >
            {!activeId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
                <MessageCircle className="h-8 w-8 opacity-50" />
                <p className="text-sm">Sélectionne une conversation.</p>
              </div>
            ) : conv.isLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !meta ? (
              <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
                Conversation introuvable.
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={closeConv}
                    aria-label="Retour"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={meta.other?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="text-xs">
                      {initialsOf(meta.other?.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {meta.other?.display_name ?? "Membre"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {meta.iBlocked
                        ? "Vous avez bloqué ce membre"
                        : meta.otherBlocked
                          ? "Indisponible"
                          : meta.status === "pending"
                            ? "Demande en attente"
                            : "Conversation privée"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={meta.iBlocked ? "Débloquer" : "Bloquer"}
                      aria-label={meta.iBlocked ? "Débloquer" : "Bloquer"}
                      onClick={() =>
                        blockMut.mutate({ id: meta.id, blocked: !meta.iBlocked })
                      }
                    >
                      {meta.iBlocked ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <ShieldOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={meta.archived ? "Désarchiver" : "Archiver"}
                      aria-label={meta.archived ? "Désarchiver" : "Archiver"}
                      onClick={() =>
                        archiveMut.mutate({ id: meta.id, archived: !meta.archived })
                      }
                    >
                      {meta.archived ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Request actions */}
                {meta.isRequestToMe && (
                  <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-3">
                    <p className="flex-1 text-sm text-muted-foreground">
                      {meta.other?.display_name ?? "Ce membre"} souhaite discuter avec toi.
                    </p>
                    <Button
                      size="sm"
                      variant="aurora"
                      onClick={() => acceptMut.mutate(meta.id)}
                    >
                      <Check className="h-4 w-4" /> Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        declineMut.mutate(meta.id);
                        closeConv();
                      }}
                    >
                      <X className="h-4 w-4" /> Refuser
                    </Button>
                  </div>
                )}

                {/* Messages */}
                <ScrollArea className="flex-1 px-4 py-4">
                  {msgs.data?.hasMore && (
                    <div className="mb-3 flex justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLimit((l) => l + 30)}
                      >
                        Charger les messages précédents
                      </Button>
                    </div>
                  )}
                  <ul className="space-y-3">
                    {messages.map((m) => {
                      const mine = m.sender_id === user?.id;
                      return (
                        <li
                          key={m.id}
                          className={cn(
                            "group flex flex-col",
                            mine ? "items-end" : "items-start",
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                              mine
                                ? "aurora-bg text-white"
                                : "bg-muted text-foreground",
                              m.deleted_at && "italic opacity-60",
                            )}
                          >
                            {m.deleted_at ? (
                              "Message supprimé"
                            ) : (
                              <span className="whitespace-pre-wrap break-words">
                                {m.body}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 px-1 text-[0.65rem] text-muted-foreground">
                            <span>{relativeTimeFr(m.created_at)}</span>
                            {m.edited_at && !m.deleted_at && <span>· modifié</span>}
                            {!m.deleted_at && mine && (
                              <span className="hidden items-center gap-1 group-hover:flex">
                                <button
                                  type="button"
                                  className="focus-ring rounded p-0.5 hover:text-foreground"
                                  aria-label="Modifier"
                                  onClick={() =>
                                    setEditing({ id: m.id, body: m.body })
                                  }
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  className="focus-ring rounded p-0.5 hover:text-destructive"
                                  aria-label="Supprimer"
                                  onClick={() => deleteMut.mutate(m.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </span>
                            )}
                            {!m.deleted_at && !mine && (
                              <ReportDialog
                                targetType="chat_message"
                                targetId={m.id}
                                label="Signaler"
                                className="focus-ring rounded p-0.5 text-[0.65rem] text-muted-foreground/70 hover:text-foreground"
                              />
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div ref={bottomRef} />
                </ScrollArea>

                {/* Composer / edit */}
                <div className="border-t border-border p-3">
                  {editing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editing.body}
                        onChange={(e) =>
                          setEditing({ ...editing, body: e.target.value })
                        }
                        rows={2}
                        maxLength={4000}
                        aria-label="Modifier le message"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(null)}
                        >
                          Annuler
                        </Button>
                        <Button
                          variant="aurora"
                          size="sm"
                          onClick={async () => {
                            const body = editing.body.trim();
                            if (body) {
                              await editMut.mutateAsync({ id: editing.id, body });
                            }
                            setEditing(null);
                          }}
                        >
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  ) : canSend ? (
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        rows={1}
                        maxLength={4000}
                        placeholder="Écris un message…"
                        aria-label="Nouveau message"
                        className="max-h-32 min-h-11 flex-1 resize-none"
                      />
                      <Button
                        variant="aurora"
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        disabled={!draft.trim() || sendMut.isPending}
                        onClick={handleSend}
                        aria-label="Envoyer"
                      >
                        {sendMut.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <p className="px-2 py-2 text-center text-xs text-muted-foreground">
                      {meta.iBlocked
                        ? "Débloque ce membre pour reprendre la conversation."
                        : meta.otherBlocked
                          ? "Vous ne pouvez pas écrire dans cette conversation."
                          : meta.isRequestToMe
                            ? "Accepte la demande pour répondre."
                            : "En attente d'acceptation de ta demande."}
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
