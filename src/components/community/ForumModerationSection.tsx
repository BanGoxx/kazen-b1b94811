import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck, ExternalLink, EyeOff, Eye, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useForumReports,
  useResolveForumReport,
  useModerateForum,
} from "@/lib/forum";

const STATUS_LABELS: Record<string, string> = {
  open: "En attente",
  action_taken: "Traités",
  dismissed: "Rejetés",
  all: "Tous",
};

export function ForumModerationSection() {
  const [status, setStatus] = useState("open");
  const { data: reports = [], isLoading } = useForumReports(true, status);
  const resolve = useResolveForumReport();
  const moderate = useModerateForum();

  async function act(
    targetType: "topic" | "post",
    targetId: string,
    action: "hide" | "unhide" | "soft_delete" | "restore",
  ) {
    try {
      await moderate.mutateAsync({ targetType, targetId, action });
      toast.success("Action appliquée");
    } catch (e) {
      toast.error("Action impossible", { description: e instanceof Error ? e.message : undefined });
    }
  }

  async function decide(id: string, next: "action_taken" | "dismissed") {
    try {
      await resolve.mutateAsync({ id, status: next });
      toast.success(next === "dismissed" ? "Signalement rejeté" : "Signalement traité");
    } catch (e) {
      toast.error("Impossible de mettre à jour", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Signalements du forum</h3>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold text-foreground">Aucun signalement</p>
          <p className="mt-1 text-sm text-muted-foreground">La communauté est saine pour le moment.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card/40 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 font-medium">
                  {r.targetType === "topic" ? "Sujet" : "Réponse"}
                </span>
                <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 font-medium">
                  {r.reason}
                </span>
                <span>par {r.reporterName}</span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-foreground/90">{r.preview}</p>
              {r.details && (
                <p className="mt-1 text-xs italic text-muted-foreground">« {r.details} »</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.link && (
                  <Button asChild variant="outline" size="sm" className="gap-1">
                    <Link to={r.link}>
                      Voir <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => act(r.targetType, r.targetId, "hide")}
                >
                  <EyeOff className="h-3.5 w-3.5" /> Masquer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => act(r.targetType, r.targetId, "unhide")}
                >
                  <Eye className="h-3.5 w-3.5" /> Afficher
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive"
                  onClick={() => act(r.targetType, r.targetId, "soft_delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => act(r.targetType, r.targetId, "restore")}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurer
                </Button>
                {r.status !== "action_taken" && r.status !== "dismissed" && (
                  <>
                    <Button
                      variant="aurora"
                      size="sm"
                      onClick={() => decide(r.id, "action_taken")}
                    >
                      Marquer traité
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => decide(r.id, "dismissed")}>
                      Rejeter
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
