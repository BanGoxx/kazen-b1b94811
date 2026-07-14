import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Rocket, CheckCircle2, Circle, AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  founderBetaOverview,
  listBetaFeedback,
  setBetaFeedbackStatus,
  BETA_FEEDBACK_CATEGORY_LABELS,
  BETA_FEEDBACK_STATUS_LABELS,
  type BetaFeedbackStatus,
} from "@/lib/beta-feedback.functions";

const STATUSES: BetaFeedbackStatus[] = [
  "received",
  "reviewing",
  "resolved",
  "dismissed",
];

// Owner-only release checklist (Phase 17). Static, honest state — no automatic
// publication, no email sending, no AI top-up. Keep in sync with the real
// operational reality before each launch decision.
const CHECKLIST: { label: string; done: boolean; note?: string }[] = [
  { label: "Code prêt", done: true },
  { label: "Typecheck OK", done: true },
  { label: "Base de données partagée prête", done: true },
  { label: "Frontend de production", done: false, note: "publication manuelle requise" },
  { label: "E-mail transactionnel", done: false, note: "non configuré (aperçu uniquement)" },
  { label: "Domaine personnalisé", done: false, note: "non configuré" },
  { label: "Kill switch IA disponible", done: true, note: "onglet Assistant IA" },
  { label: "Facturation IA", done: true, note: "visibilité externe à l'app" },
  { label: "QA chat multi-comptes", done: false, note: "test A/B/C réel à faire après lancement" },
  { label: "Sauvegarde / rollback", done: true, note: "géré par la plateforme" },
];

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">
        {value === null ? "—" : value}
      </p>
    </div>
  );
}

export function FounderBetaSection() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(founderBetaOverview);
  const listFn = useServerFn(listBetaFeedback);
  const statusFn = useServerFn(setBetaFeedbackStatus);

  const { data: overview } = useQuery({
    queryKey: ["founder-beta-overview"],
    queryFn: () => overviewFn(),
  });
  const { data: feedback } = useQuery({
    queryKey: ["founder-beta-feedback"],
    queryFn: () => listFn(),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: BetaFeedbackStatus }) =>
      statusFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["founder-beta-feedback"] });
      qc.invalidateQueries({ queryKey: ["founder-beta-overview"] });
      toast.success("Statut mis à jour.");
    },
    onError: () => toast.error("Mise à jour impossible."),
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Rocket className="h-4 w-4 text-primary" /> Aperçu du lancement bêta
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Membres" value={overview?.members ?? null} />
          <Metric label="Nouveaux (7j)" value={overview?.newMembers7d ?? null} />
          <Metric label="Actifs (7j)" value={overview?.activeMembers7d ?? null} />
          <Metric label="Retours reçus" value={overview?.feedbackTotal ?? null} />
          <Metric label="Retours à traiter" value={overview?.feedbackUnresolved ?? null} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Compteurs agrégés uniquement. Usage IA, rejets de quota, imports et
          erreurs providers restent dans les onglets Assistant IA et Santé.
          Aucun prompt IA ni message privé n'est stocké ici.
        </p>
      </section>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-500">
          <AlertTriangle className="h-4 w-4" /> Statut chat privé
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sécurité et RLS validées, code validé. L'expérience multi-comptes en
          conditions réelles n'est pas entièrement vérifiée. Le chat reste actif.
          <strong className="text-foreground"> À faire : effectuer un test A/B/C réel après lancement.</strong>
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Checklist de lancement</h2>
        <ul className="space-y-2">
          {CHECKLIST.map((item) => (
            <li key={item.label} className="flex items-start gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              )}
              <span>
                <span className={item.done ? "" : "font-medium text-foreground"}>
                  {item.label}
                </span>
                {item.note ? (
                  <span className="text-muted-foreground"> — {item.note}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <MessageSquare className="h-4 w-4 text-primary" /> Retours des membres
        </h2>
        {feedback && feedback.length ? (
          <ul className="space-y-3">
            {feedback.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-border bg-card/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                      {BETA_FEEDBACK_CATEGORY_LABELS[f.category]}
                    </span>
                    <span className="font-semibold">{f.title}</span>
                  </span>
                  <Select
                    value={f.status}
                    onValueChange={(v) =>
                      setStatus.mutate({ id: f.id, status: v as BetaFeedbackStatus })
                    }
                  >
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {BETA_FEEDBACK_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {f.body}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(f.createdAt).toLocaleString("fr-FR")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun retour pour l'instant.
          </p>
        )}
      </section>
    </div>
  );
}
