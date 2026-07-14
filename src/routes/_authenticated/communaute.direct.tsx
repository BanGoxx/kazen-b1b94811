import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Loader2,
  Send,
  Radio,
  Reply as ReplyIcon,
  Pencil,
  Trash2,
  Flag,
  ShieldOff,
  EyeOff,
  RotateCcw,
  X as XIcon,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useIsModerator } from "@/lib/use-moderator";
import { cn } from "@/lib/utils";
import {
  useLiveChatRoom,
  useLiveChatMemberState,
  useFlatLiveChatMessages,
  useLiveChatRealtime,
  useSendLiveChatMessage,
  useEditLiveChatMessage,
  useDeleteLiveChatMessage,
  useMarkLiveChatRead,
  useReportLiveChatMessage,
  useHideLiveChatMessage,
  useBlockedMemberIds,
  type LiveChatMessage,
} from "@/lib/live-chat";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/communaute/direct")({
  head: () => ({
    meta: [
      { title: "Chat en direct — KAZEN" },
      {
        name: "description",
        content:
          "Rejoins la conversation en direct de la communauté KAZEN autour des anime, séries et films.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LiveChatPage,
});

const REPORT_REASONS = [
  { value: "spam", label: "Spam ou publicité" },
  { value: "harassment", label: "Harcèlement ou propos haineux" },
  { value: "inappropriate", label: "Contenu inapproprié" },
  { value: "hate", label: "Haine ou discrimination" },
  { value: "spoiler", label: "Spoiler non signalé" },
  { value: "impersonation", label: "Usurpation d'identité" },
  { value: "illegal", label: "Contenu illégal" },
  { value: "other", label: "Autre" },
];

const BODY_MAX = 500;

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
function formatDay(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return "";
  }
}

function LiveChatPage() {
  const { user } = useAuth();
  const isModerator = useIsModerator();
  const { data: room, isLoading: roomLoading } = useLiveChatRoom();
  const roomId = room?.id;
  const { data: memberState } = useLiveChatMemberState(roomId);
  const rtStatus = useLiveChatRealtime(roomId);
  const {
    messages,
    isLoading,
    hasOlder,
    loadOlder,
    refetch,
  } = useFlatLiveChatMessages(roomId);
  const { data: blocked } = useBlockedMemberIds();
  const send = useSendLiveChatMessage();
  const edit = useEditLiveChatMessage(roomId);
  const del = useDeleteLiveChatMessage(roomId);
  const markRead = useMarkLiveChatRead();
  const report = useReportLiveChatMessage();
  const { hide, restore } = useHideLiveChatMessage(roomId);

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<LiveChatMessage | null>(null);
  const [editing, setEditing] = useState<LiveChatMessage | null>(null);
  const [reportTarget, setReportTarget] = useState<LiveChatMessage | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);

  const restrictedUntil = memberState?.restricted_until
    ? new Date(memberState.restricted_until)
    : null;
  const isRestricted = !!restrictedUntil && restrictedUntil > new Date();
  const roomReadOnly = room && !room.is_active;
  const canSend = !!user && !isRestricted && !roomReadOnly;

  const lastReadAt = memberState?.last_read_at
    ? new Date(memberState.last_read_at)
    : null;

  // Track whether user is near bottom to decide auto-scroll behavior.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      stickBottomRef.current = nearBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll to bottom on new messages if user is already at bottom.
  useEffect(() => {
    if (stickBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages.length]);

  // Mark room as read when messages change and tab is visible.
  useEffect(() => {
    if (!roomId || messages.length === 0) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible")
      return;
    const t = setTimeout(() => markRead.mutate(roomId), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, messages[messages.length - 1]?.id]);

  const blockedIds = blocked ?? new Set<string>();

  const displayMessages = useMemo(() => {
    return messages.filter((m) => {
      // Hide messages from blocked members for the viewer only.
      if (blockedIds.has(m.author_id) && m.author_id !== user?.id) return false;
      return true;
    });
  }, [messages, blockedIds, user?.id]);

  // Insert unread divider before the first message strictly newer than lastReadAt.
  const unreadDividerIndex = useMemo(() => {
    if (!lastReadAt) return -1;
    for (let i = 0; i < displayMessages.length; i += 1) {
      const m = displayMessages[i];
      if (m.author_id === user?.id) continue;
      if (new Date(m.created_at) > lastReadAt) return i;
    }
    return -1;
  }, [displayMessages, lastReadAt, user?.id]);

  function submit() {
    if (!roomId) return;
    const clean = body.trim();
    if (!clean) return;
    if (clean.length > BODY_MAX) {
      toast.error(`Maximum ${BODY_MAX} caractères.`);
      return;
    }
    if (editing) {
      edit.mutate(
        { id: editing.id, body: clean },
        {
          onSuccess: () => {
            setEditing(null);
            setBody("");
          },
        },
      );
      return;
    }
    send.mutate(
      {
        roomId,
        body: clean,
        replyTo: replyTo?.id,
      },
      {
        onSuccess: () => {
          setBody("");
          setReplyTo(null);
          stickBottomRef.current = true;
        },
      },
    );
  }

  const connectionLabel =
    rtStatus === "connected"
      ? "En direct"
      : rtStatus === "connecting"
        ? "Connexion…"
        : rtStatus === "reconnecting"
          ? "Reconnexion…"
          : rtStatus === "disconnected"
            ? "Hors ligne"
            : "";

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col gap-3 px-3 py-4 sm:px-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">
                {room?.name ?? "Chat en direct"}
              </h1>
              <Badge variant="outline" className="text-[10px]">
                Bêta
              </Badge>
              {roomReadOnly ? (
                <Badge variant="secondary" className="text-[10px]">
                  Lecture seule
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {room?.description ??
                "Discute en direct avec la communauté KAZEN."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connectionLabel ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]",
                rtStatus === "connected"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : rtStatus === "disconnected"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  rtStatus === "connected"
                    ? "bg-emerald-500"
                    : rtStatus === "disconnected"
                      ? "bg-destructive"
                      : "bg-muted-foreground animate-pulse",
                )}
              />
              {connectionLabel}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            aria-label="Rafraîchir"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {roomReadOnly ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
          Le chat en direct est temporairement en lecture seule.
        </div>
      ) : null}
      {isRestricted && restrictedUntil ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          Envoi restreint jusqu'à{" "}
          {restrictedUntil.toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
          {memberState?.restricted_reason
            ? ` — ${memberState.restricted_reason}`
            : ""}
          .
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-border/50 bg-card/40 p-3 sm:p-4"
      >
        {roomLoading || isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Aucun message pour le moment. Sois le premier à lancer la
            discussion.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {hasOlder ? (
              <div className="flex justify-center pb-2">
                <Button size="sm" variant="ghost" onClick={loadOlder}>
                  Charger les messages plus anciens
                </Button>
              </div>
            ) : null}
            {displayMessages.map((m, i) => {
              const prev = displayMessages[i - 1];
              const showDay =
                !prev ||
                formatDay(prev.created_at) !== formatDay(m.created_at);
              const showUnread = i === unreadDividerIndex;
              const replied = m.reply_to_id
                ? messages.find((x) => x.id === m.reply_to_id)
                : null;
              return (
                <div key={m.id}>
                  {showDay ? (
                    <div className="my-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border/60" />
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {formatDay(m.created_at)}
                      </span>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                  ) : null}
                  {showUnread ? (
                    <div className="my-2 flex items-center gap-2">
                      <div className="h-px flex-1 bg-primary/40" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                        Nouveaux messages
                      </span>
                      <div className="h-px flex-1 bg-primary/40" />
                    </div>
                  ) : null}
                  <MessageRow
                    message={m}
                    repliedTo={replied ?? null}
                    isOwn={m.author_id === user?.id}
                    isModerator={isModerator}
                    onReply={() => setReplyTo(m)}
                    onEdit={() => {
                      setEditing(m);
                      setBody(m.body);
                      setReplyTo(null);
                    }}
                    onDelete={() => del.mutate(m.id)}
                    onReport={() => setReportTarget(m)}
                    onBlock={async () => {
                      try {
                        await setMemberBlock(m.author_id, true);
                        toast.success("Membre bloqué.");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                    onHide={() => hide.mutate({ id: m.id })}
                    onRestore={() => restore.mutate(m.id)}
                  />
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm">
        {replyTo ? (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs">
            <span className="truncate">
              <span className="font-medium">
                Répondre à {replyTo.author?.display_name ?? "Membre KAZEN"} :
              </span>{" "}
              <span className="text-muted-foreground">
                {replyTo.body.slice(0, 120)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Annuler la réponse"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        {editing ? (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs">
            <span>Édition du message</span>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setBody("");
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Annuler l'édition"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              canSend
                ? "Écris un message… (Entrée pour envoyer)"
                : "Envoi indisponible"
            }
            disabled={!canSend}
            rows={2}
            className="min-h-[44px] resize-none"
            maxLength={BODY_MAX}
          />
          <Button
            type="button"
            onClick={submit}
            disabled={
              !canSend || !body.trim() || send.isPending || edit.isPending
            }
            className="h-11"
          >
            {send.isPending || edit.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">
              {editing ? "Enregistrer" : "Envoyer"}
            </span>
          </Button>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Texte brut uniquement — aucun média ne peut être joint.</span>
          <span>
            {body.length}/{BODY_MAX}
          </span>
        </div>
      </div>

      <ReportDialog
        message={reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={(reason, details) => {
          if (!reportTarget) return;
          report.mutate(
            { id: reportTarget.id, reason, details },
            { onSuccess: () => setReportTarget(null) },
          );
        }}
      />
    </div>
  );
}

function MessageRow({
  message,
  repliedTo,
  isOwn,
  isModerator,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onBlock,
  onHide,
  onRestore,
}: {
  message: LiveChatMessage;
  repliedTo: LiveChatMessage | null;
  isOwn: boolean;
  isModerator: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  onBlock: () => void;
  onHide: () => void;
  onRestore: () => void;
}) {
  const isDeleted = !!message.deleted_at;
  const isHidden = !!message.hidden_at;
  const author = message.author;
  const initials = (author?.display_name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group flex items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-muted/40">
      <Avatar className="h-9 w-9">
        {author?.avatar_url ? <AvatarImage src={author.avatar_url} /> : null}
        <AvatarFallback>{initials || "?"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium">
            {author?.display_name ?? "Membre KAZEN"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatTime(message.created_at)}
          </span>
          {message.edited_at && !isDeleted ? (
            <span className="text-[10px] text-muted-foreground">(modifié)</span>
          ) : null}
        </div>
        {repliedTo ? (
          <div className="mt-1 rounded-md border-l-2 border-primary/40 bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
            <span className="font-medium">
              {repliedTo.author?.display_name ?? "Membre KAZEN"} :
            </span>{" "}
            <span>{repliedTo.body.slice(0, 140)}</span>
          </div>
        ) : null}
        <div className="mt-0.5 whitespace-pre-wrap break-words text-sm">
          {isDeleted ? (
            <span className="italic text-muted-foreground">
              Message supprimé
            </span>
          ) : isHidden ? (
            <span className="italic text-muted-foreground">
              Message masqué par la modération
            </span>
          ) : (
            message.body
          )}
        </div>
      </div>
      <div className="opacity-0 transition group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              …
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!isDeleted && !isHidden ? (
              <DropdownMenuItem onClick={onReply}>
                <ReplyIcon className="mr-2 h-3.5 w-3.5" /> Répondre
              </DropdownMenuItem>
            ) : null}
            {isOwn && !isDeleted ? (
              <>
                <DropdownMenuItem onClick={onEdit} disabled={isHidden}>
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Modifier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Supprimer
                </DropdownMenuItem>
              </>
            ) : null}
            {!isOwn ? (
              <>
                <DropdownMenuItem onClick={onReport}>
                  <Flag className="mr-2 h-3.5 w-3.5" /> Signaler
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onBlock}>
                  <ShieldOff className="mr-2 h-3.5 w-3.5" /> Bloquer ce membre
                </DropdownMenuItem>
              </>
            ) : null}
            {isModerator ? (
              <>
                <DropdownMenuSeparator />
                {isHidden ? (
                  <DropdownMenuItem onClick={onRestore}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Restaurer
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onHide}>
                    <EyeOff className="mr-2 h-3.5 w-3.5" /> Masquer (modération)
                  </DropdownMenuItem>
                )}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ReportDialog({
  message,
  onClose,
  onSubmit,
}: {
  message: LiveChatMessage | null;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => void;
}) {
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  useEffect(() => {
    if (message) {
      setReason("spam");
      setDetails("");
    }
  }, [message]);
  return (
    <Dialog open={!!message} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signaler ce message</DialogTitle>
          <DialogDescription>
            L'équipe de modération recevra le message et le contexte
            nécessaire.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Motif</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Détails (optionnel)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Contexte utile pour la modération…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => onSubmit(reason, details)}>Envoyer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
