import { useState, type ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  Loader2,
  EyeOff,
  Eye,
  Trash2,
  RotateCcw,
  XCircle,
  ExternalLink,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { MediaRequestsPanel } from "@/components/moderation/MediaRequestsPanel";
import { CorrectionRequestsPanel } from "@/components/moderation/CorrectionRequestsPanel";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import {
  moderationQueue,
  targetModerationHistory,
  moderateContent,
  type ModerationActionType,
  type ModerationTargetType,
} from "@/lib/moderation.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/moderation")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: "/moderation" } });
    const { data: isMod } = await supabase.rpc("can_moderate_now", {
      _user_id: data.user.id,
    });
    if (!isMod) throw redirect({ to: "/" });
  },
  component: ModerationPage,
});

const TARGET_LABELS: Record<string, string> = {
  review: "Avis",
  reply: "Réponse",
  playlist: "Playlist partagée",
  playlist_item: "Élément de liste",
  playlist_review: "Avis sur une liste",
  chat_message: "Message privé",
};

const ACTION_LABELS: Record<string, string> = {
  hide: "Masqué",
  unhide: "Ré-affiché",
  soft_delete: "Supprimé (réversible)",
  restore: "Restauré",
  dismiss_report: "Signalement rejeté",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type PendingAction = {
  action: ModerationActionType;
  label: string;
  targetType: ModerationTargetType;
  targetId: string;
  reportId: string;
};

function ModerationPage() {
  const queue = useServerFn(moderationQueue);
  const history = useServerFn(targetModerationHistory);
  const moderate = useServerFn(moderateContent);
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["moderation-queue"],
    queryFn: () => queue({ data: {} }),
  });

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const { data: actions = [] } = useQuery({
    queryKey: ["moderation-history", selected?.target_type, selected?.target_id],
    queryFn: () =>
      history({
        data: {
          targetType: selected!.target_type as ModerationTargetType,
          targetId: selected!.target_id,
        },
      }),
    enabled: Boolean(selected),
  });

  const runAction = useMutation({
    mutationFn: (p: PendingAction) =>
      moderate({
        data: {
          targetType: p.targetType,
          targetId: p.targetId,
          action: p.action,
          reportId: p.reportId,
        },
      }),
    onSuccess: (_res, p) => {
      toast.success(`Action appliquée : ${p.label}.`);
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
      qc.invalidateQueries({ queryKey: ["moderation-history"] });
    },
    onError: () => toast.error("L'action n'a pas pu être appliquée."),
    onSettled: () => setPending(null),
  });

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/60">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Modération</h1>
            <p className="text-sm text-muted-foreground">
              Signalements en attente. L'autorité finale reste au propriétaire.
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement de la file…
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 p-10 text-center">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold text-foreground">Aucun signalement en attente</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tout est propre pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            {/* Liste */}
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      "focus-ring w-full rounded-2xl border bg-card/40 p-4 text-left transition-colors hover:border-primary/50",
                      selectedId === r.id ? "border-primary" : "border-border",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {TARGET_LABELS[r.target_type] ?? r.target_type}
                      </span>
                      {(r.target.hidden || r.target.softDeleted) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
                          <EyeOff className="h-3 w-3" />
                          {r.target.softDeleted ? "Supprimé" : "Masqué"}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {r.reason}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {r.target.preview}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Signalé par {r.reporterName ?? "un membre"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>

            {/* Détail */}
            <aside className="lg:sticky lg:top-4 lg:self-start">
              {selected ? (
                <div className="rounded-2xl border border-border bg-card/60 p-4">
                  <h2 className="text-sm font-bold text-foreground">
                    {TARGET_LABELS[selected.target_type] ?? selected.target_type}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl border border-border/60 bg-background/40 p-3 text-sm text-foreground/90">
                    {selected.target.preview}
                  </p>

                  {selected.details && (
                    <div className="mt-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Détails du signalement
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selected.details}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                    <p>Motif : <span className="text-foreground/80">{selected.reason}</span></p>
                    <p>Signalé par : {selected.reporterName ?? "un membre"}</p>
                    <p>Créé le : {formatDate(selected.created_at)}</p>
                    <p>
                      État : {selected.target.softDeleted
                        ? "Supprimé (réversible)"
                        : selected.target.hidden
                          ? "Masqué"
                          : "Visible"}
                    </p>
                    {selected.target.link && (
                      <a
                        href={selected.target.link}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Voir le contenu
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {!selected.target.hidden ? (
                      <ActionBtn
                        icon={<EyeOff className="h-3.5 w-3.5" />}
                        label="Masquer"
                        onClick={() =>
                          setPending({
                            action: "hide",
                            label: "Masquer",
                            targetType: selected.target_type as ModerationTargetType,
                            targetId: selected.target_id,
                            reportId: selected.id,
                          })
                        }
                      />
                    ) : (
                      <ActionBtn
                        icon={<Eye className="h-3.5 w-3.5" />}
                        label="Ré-afficher"
                        onClick={() =>
                          setPending({
                            action: "unhide",
                            label: "Ré-afficher",
                            targetType: selected.target_type as ModerationTargetType,
                            targetId: selected.target_id,
                            reportId: selected.id,
                          })
                        }
                      />
                    )}
                    {!selected.target.softDeleted ? (
                      <ActionBtn
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        label="Supprimer"
                        destructive
                        onClick={() =>
                          setPending({
                            action: "soft_delete",
                            label: "Supprimer",
                            targetType: selected.target_type as ModerationTargetType,
                            targetId: selected.target_id,
                            reportId: selected.id,
                          })
                        }
                      />
                    ) : (
                      <ActionBtn
                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                        label="Restaurer"
                        onClick={() =>
                          setPending({
                            action: "restore",
                            label: "Restaurer",
                            targetType: selected.target_type as ModerationTargetType,
                            targetId: selected.target_id,
                            reportId: selected.id,
                          })
                        }
                      />
                    )}
                    <ActionBtn
                      icon={<XCircle className="h-3.5 w-3.5" />}
                      label="Rejeter le signalement"
                      className="col-span-2"
                      onClick={() =>
                        setPending({
                          action: "dismiss_report",
                          label: "Rejeter le signalement",
                          targetType: selected.target_type as ModerationTargetType,
                          targetId: selected.target_id,
                          reportId: selected.id,
                        })
                      }
                    />
                  </div>

                  {/* Historique */}
                  <div className="mt-5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Historique récent
                    </p>
                    {actions.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Aucune action pour ce contenu.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {actions.map((a) => (
                          <li
                            key={a.id}
                            className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground/90">
                                {ACTION_LABELS[a.action] ?? a.action}
                              </span>
                              <span className="text-muted-foreground">
                                {formatDate(a.created_at)}
                              </span>
                            </div>
                            {a.note && (
                              <p className="mt-1 text-muted-foreground">{a.note}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center text-sm text-muted-foreground">
                  Sélectionnez un signalement pour voir les détails et agir.
                </div>
              )}
            </aside>
          </div>
        )}

        <MediaRequestsPanel />
        <CorrectionRequestsPanel />
      </div>

      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Confirmer l'action
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point d'appliquer : <strong>{pending?.label}</strong>.
              Cette action est enregistrée dans le journal de modération.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={runAction.isPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pending && runAction.mutate(pending)}
              disabled={runAction.isPending}
            >
              {runAction.isPending ? "Application…" : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  destructive,
  className,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  className?: string;
}) {
  return (
    <Button
      variant={destructive ? "destructive" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn("justify-start", className)}
    >
      {icon}
      <span className="ml-1.5">{label}</span>
    </Button>
  );
}
