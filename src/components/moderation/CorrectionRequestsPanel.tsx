import { useState } from "react";
import { toast } from "sonner";
import { Inbox, Loader2, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  useAllFicheCorrections,
  useFicheCorrectionMutations,
  CORRECTION_CATEGORY_LABELS,
  CORRECTION_CATEGORY_ORDER,
  CORRECTION_STATUS_LABELS,
  type CorrectionCategory,
  type CorrectionStatus,
} from "@/lib/fiche-corrections";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NEXT: { status: CorrectionStatus; label: string }[] = [
  { status: "reviewing", label: "En cours" },
  { status: "need_info", label: "Complément" },
  { status: "accepted", label: "Accepter" },
  { status: "rejected", label: "Rejeter" },
];

/**
 * Owner-only review of member fiche correction requests. Rendered inside the
 * owner-gated /moderation route, so RLS + route guard both apply. Reviewing
 * records an audit trail and NEVER edits catalogue data automatically.
 */
export function CorrectionRequestsPanel() {
  const [category, setCategory] = useState<CorrectionCategory | "all">("all");
  const { data: requests = [], isLoading } = useAllFicheCorrections(true, { category });
  const { review } = useFicheCorrectionMutations();
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, status: CorrectionStatus) => {
    setBusy(id);
    try {
      await review.mutateAsync({ id, status });
      toast.success("Signalement mis à jour.");
    } catch {
      toast.error("Action impossible.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-10 space-y-4">
      <header className="flex items-center gap-2">
        <Inbox className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Signalements de fiches</h2>
        <span className="text-sm text-muted-foreground">({requests.length})</span>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={cn(
            "focus-ring rounded-full px-3 py-1 text-xs font-semibold transition-colors",
            category === "all"
              ? "aurora-bg text-white"
              : "border border-border bg-card/60 text-muted-foreground hover:text-foreground",
          )}
        >
          Tout
        </button>
        {CORRECTION_CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "focus-ring rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              category === c
                ? "aurora-bg text-white"
                : "border border-border bg-card/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {CORRECTION_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </p>
      ) : requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
          Aucun signalement pour ce filtre.
        </p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card/40 p-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-primary">
                    {CORRECTION_CATEGORY_LABELS[r.category]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {CORRECTION_STATUS_LABELS[r.status]}
                  </span>
                </div>
                <p className="font-semibold text-foreground">{r.mediaTitle || "Fiche"}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>
                <Link
                  to="/media/$source/$id"
                  params={{ source: r.source, id: r.externalId }}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Ouvrir la fiche
                </Link>
              </div>
              <div className="flex flex-wrap gap-1">
                {NEXT.map((n) => (
                  <Button
                    key={n.status}
                    variant={r.status === n.status ? "aurora" : "ghost"}
                    size="sm"
                    disabled={busy === r.id || r.status === n.status}
                    onClick={() => act(r.id, n.status)}
                    className="text-xs"
                  >
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : n.label}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
