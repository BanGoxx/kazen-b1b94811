import { useState } from "react";
import { Users, UserPlus, Check, X, Crown, Pencil, Eye, LogOut, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  useMyPlaylistRole,
  useMyJoinRequest,
  usePlaylistCollaborators,
  usePlaylistJoinRequests,
  useCollabMutations,
} from "@/lib/playlist-collab";

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function CollabPanel({
  playlistId,
  ownerId,
  isPublic,
}: {
  playlistId: string;
  ownerId: string;
  isPublic: boolean;
}) {
  const { user } = useAuth();
  const { data: role } = useMyPlaylistRole(playlistId, ownerId);
  const isOwner = role === "owner";
  const isCollaborator = role === "editor" || role === "viewer";
  const canRequest = Boolean(user) && !isOwner && !isCollaborator;

  const { data: requestStatus } = useMyJoinRequest(playlistId, canRequest);
  const { data: collaborators } = usePlaylistCollaborators(
    playlistId,
    Boolean(user) && (isOwner || isCollaborator),
  );
  const { data: requests } = usePlaylistJoinRequests(playlistId, isOwner);
  const m = useCollabMutations(playlistId);
  const [message, setMessage] = useState("");

  if (!user) return null;

  const collabCount = collaborators?.length ?? 0;

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card/50 p-6 backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4 text-primary" />
        Collaboration
        {collabCount > 0 && (
          <span className="text-xs font-normal text-muted-foreground">
            · {collabCount} collaborateur{collabCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Non-collaborator: request to join */}
      {canRequest && (
        <div className="space-y-3">
          {requestStatus === "pending" ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" /> Demande en attente de validation
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={m.cancelRequest.isPending}
                onClick={() => m.cancelRequest.mutate()}
              >
                Annuler
              </Button>
            </div>
          ) : requestStatus === "declined" ? (
            <p className="text-sm text-muted-foreground">
              Ta demande précédente a été refusée par le propriétaire.
            </p>
          ) : (
            isPublic && (
              <>
                <p className="text-sm text-muted-foreground">
                  Envie de contribuer à cette liste ? Demande à rejoindre l'équipe d'édition.
                </p>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message au propriétaire (facultatif)"
                  rows={2}
                  maxLength={500}
                  className="resize-none"
                />
                <Button
                  variant="aurora"
                  size="sm"
                  className="gap-1.5"
                  disabled={m.requestToJoin.isPending}
                  onClick={() => m.requestToJoin.mutate(message)}
                >
                  <UserPlus className="h-4 w-4" /> Demander à rejoindre
                </Button>
              </>
            )
          )}
        </div>
      )}

      {/* Collaborator: role badge + leave */}
      {isCollaborator && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3">
          <span className="flex items-center gap-2 text-sm text-foreground">
            {role === "editor" ? (
              <>
                <Pencil className="h-4 w-4 text-primary" /> Tu es éditeur de cette liste
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 text-muted-foreground" /> Tu suis cette liste
              </>
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            disabled={m.leave.isPending}
            onClick={() => m.leave.mutate()}
          >
            <LogOut className="h-4 w-4" /> Quitter
          </Button>
        </div>
      )}

      {/* Owner: pending requests */}
      {isOwner && requests && requests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Demandes en attente ({requests.length})
          </p>
          {requests.map((r) => (
            <div
              key={r.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3"
            >
              <div className="flex min-w-0 items-start gap-2">
                <Avatar className="h-7 w-7 shrink-0">
                  {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt="" />}
                  <AvatarFallback className="bg-muted text-[10px]">
                    {initials(r.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.displayName}</p>
                  {r.message && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{r.message}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="aurora"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Accepter"
                  disabled={m.acceptRequest.isPending}
                  onClick={() => m.acceptRequest.mutate({ id: r.id, requesterId: r.requesterId })}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Refuser"
                  disabled={m.declineRequest.isPending}
                  onClick={() => m.declineRequest.mutate(r.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Owner: manage collaborators */}
      {isOwner && collaborators && collaborators.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Collaborateurs
          </p>
          {collaborators.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/40 p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="h-7 w-7 shrink-0">
                  {c.avatarUrl && <AvatarImage src={c.avatarUrl} alt="" />}
                  <AvatarFallback className="bg-muted text-[10px]">
                    {initials(c.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium text-foreground">
                  {c.displayName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.62rem] font-bold uppercase text-primary">
                  {c.role === "editor" ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {c.role === "editor" ? "Éditeur" : "Lecteur"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={m.setRole.isPending}
                  onClick={() =>
                    m.setRole.mutate({
                      collaboratorId: c.id,
                      role: c.role === "editor" ? "viewer" : "editor",
                    })
                  }
                >
                  {c.role === "editor" ? "Passer lecteur" : "Passer éditeur"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  aria-label="Retirer"
                  disabled={m.removeCollaborator.isPending}
                  onClick={() => m.removeCollaborator.mutate(c.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOwner && (!collaborators || collaborators.length === 0) && (!requests || requests.length === 0) && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Crown className="h-4 w-4 text-primary" /> Personne ne collabore encore. Les membres
          peuvent demander à rejoindre depuis cette page.
        </p>
      )}
    </section>
  );
}
