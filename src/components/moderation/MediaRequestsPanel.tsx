import { useState } from "react";
import { toast } from "sonner";
import { Inbox, Loader2, ExternalLink } from "lucide-react";
import {
  useAllMediaRequests,
  useMediaRequestMutations,
  MEDIA_REQUEST_TYPE_LABELS,
  MEDIA_REQUEST_STATUS_LABELS,
  type MediaRequestStatus,
} from "@/lib/media-requests";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NEXT: { status: MediaRequestStatus; label: string }[] = [
  { status: "reviewing", label: "En cours" },
  { status: "accepted", label: "Accepter" },
  { status: "rejected", label: "Rejeter" },
  { status: "duplicate", label: "Doublon" },
];

/**
 * Owner-only review of member "Proposer ce titre" requests. Rendered inside the
 * owner-gated /moderation route, so RLS + route guard both apply.
 */
export function MediaRequestsPanel() {
  const { data: requests = [], isLoading } = useAllMediaRequests(true);
  const { review } = useMediaRequestMutations();
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, status: MediaRequestStatus) => {
    setBusy(id);
    try {
      await review.mutateAsync({ id, status });
      toast.success("Proposition mise à jour.");
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
        <h2 className="text-lg font-bold text-foreground">Titres proposés</h2>
        <span className="text-sm text-muted-foreground">({requests.length})</span>
      </header>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </p>
      ) : requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
          Aucune proposition de titre pour l'instant.
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
                    {MEDIA_REQUEST_TYPE_LABELS[r.mediaType]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {MEDIA_REQUEST_STATUS_LABELS[r.status]}
                  </span>
                </div>
                <p className="font-semibold text-foreground">{r.title}</p>
                {r.note && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{r.note}</p>
                )}
                {r.externalUrl && (
                  <a
                    href={r.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Lien externe
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {NEXT.map((n) => (
                  <Button
                    key={n.status}
                    variant={r.status === n.status ? "aurora" : "ghost"}
                    size="sm"
                    disabled={busy === r.id || r.status === n.status}
                    onClick={() => act(r.id, n.status)}
                    className={cn("text-xs")}
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
