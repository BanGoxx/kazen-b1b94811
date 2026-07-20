// KAZEN — Import Canonicalization V2 UI panel (Phase G).
//
// Reuses the visual language of `/import` (dark palette, rounded-xl cards,
// existing Button/Badge/Checkbox primitives). No logo, font or palette change.
// Only rendered when the SERVER says the caller is V2-eligible AND the user
// picked the native AniList provider. Otherwise `/import` renders V1 exactly
// as before, byte-for-byte.

import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2, AlertTriangle, Undo2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchAniListImport, AniListImportError } from "@/lib/import/anilist-list";
import {
  createCanonicalBatchV2Fn,
  processCanonicalBatchV2Fn,
  getCanonicalProgressV2Fn,
  getCanonicalPreviewV2Fn,
  confirmCanonicalImportV2Fn,
  skipFailedCanonicalItemsV2Fn,
  rollbackCanonicalImportV2Fn,
} from "@/lib/import-canonical-v2.functions";

type ProgressCounters = {
  total?: number;
  canonical_count?: number;
  failed_count?: number;
  pending_count?: number;
  claimed_count?: number;
  status?: string;
};

type PreviewItem = {
  id: string;
  ordinal: number;
  provider_ref: string;
  status: string;
  canonical_snapshot: Record<string, unknown> | null;
  error_code: string | null;
};

type Phase = "idle" | "fetching" | "creating" | "processing" | "preview" | "confirmed";

// Persist just the batch id across a browser refresh so we can offer a resume.
// The id is not sensitive; server-side ownership is re-checked on every RPC.
const RESUME_KEY = "kazen.canonicalV2.batchId";

function pickTitle(snapshot: Record<string, unknown> | null, providerRef: string): string {
  if (!snapshot) return providerRef;
  const t =
    (snapshot.title as string | undefined) ??
    (snapshot.title_original as string | undefined);
  return t && t.length > 0 ? t : providerRef;
}

export function CanonicalV2Import() {
  const createBatch = useServerFn(createCanonicalBatchV2Fn);
  const processBatch = useServerFn(processCanonicalBatchV2Fn);
  const getProgress = useServerFn(getCanonicalProgressV2Fn);
  const getPreview = useServerFn(getCanonicalPreviewV2Fn);
  const confirmBatch = useServerFn(confirmCanonicalImportV2Fn);
  const skipFailed = useServerFn(skipFailedCanonicalItemsV2Fn);
  const rollbackBatch = useServerFn(rollbackCanonicalImportV2Fn);

  const [username, setUsername] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [counters, setCounters] = useState<ProgressCounters | null>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [summary, setSummary] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  // Cancel polling on unmount / phase change.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Offer to resume a batch id left by a previous session (refresh recovery).
  const [resumeId, setResumeId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const s = window.localStorage.getItem(RESUME_KEY);
      if (s) setResumeId(s);
    } catch {
      /* ignore */
    }
  }, []);

  const persistBatch = (id: string | null) => {
    try {
      if (id) window.localStorage.setItem(RESUME_KEY, id);
      else window.localStorage.removeItem(RESUME_KEY);
    } catch {
      /* ignore */
    }
  };

  const pollUntilDone = useCallback(
    async (id: string) => {
      // Bounded polling loop: at most 60 iterations of (process 2 chunks + progress).
      // Each iteration processes up to 2 chunks server-side (max 100 items),
      // so 60 iterations covers 6000 items — well above the 5000 hard cap.
      for (let i = 0; i < 60; i++) {
        if (cancelledRef.current) return;
        const res = await processBatch({ data: { batchId: id, maxChunks: 2 } });
        if (cancelledRef.current) return;
        const prog = (await getProgress({ data: { batchId: id } })) as ProgressCounters;
        setCounters(prog);
        if (res.done || (prog.pending_count ?? 0) === 0 && (prog.claimed_count ?? 0) === 0) {
          return;
        }
        // Small pause to avoid tight-looping the server and give the shared
        // AniList queue room to breathe.
        await new Promise((r) => setTimeout(r, 400));
      }
      throw new Error("V2: polling budget exceeded");
    },
    [processBatch, getProgress],
  );

  const loadPreview = useCallback(
    async (id: string) => {
      const pv = await getPreview({ data: { batchId: id } });
      setCounters(pv.counters as ProgressCounters);
      setItems(pv.items as PreviewItem[]);
      setPhase("preview");
    },
    [getPreview],
  );

  const handleStart = async (rawUsername: string) => {
    const name = rawUsername.trim();
    if (!name) return;
    setPhase("fetching");
    setBatchId(null);
    setCounters(null);
    setItems([]);
    setSummary(null);
    try {
      // 1. Client fetches the public AniList list (same helper V1 uses).
      const { entries, warnings } = await fetchAniListImport(name);
      for (const w of warnings) toast.message(w);

      // 2. Client sends ONLY provider + provider_ref. No title/poster/genres/
      //    score/release_date/media_key/canonical_snapshot/user_id — the DB
      //    build_canonical is the sole authority.
      const providerItems = entries
        .filter((e) => e.providerId)
        .map((e) => ({ provider_ref: String(e.providerId) }));
      if (providerItems.length === 0) throw new Error("Aucun identifiant AniList détecté.");

      setPhase("creating");
      const { batchId: id } = await createBatch({
        data: { provider: "anilist", items: providerItems },
      });
      setBatchId(id);
      persistBatch(id);

      // 3. Poll process + progress.
      setPhase("processing");
      await pollUntilDone(id);

      // 4. Preview.
      await loadPreview(id);
    } catch (err) {
      setPhase("idle");
      persistBatch(null);
      toast.error(
        err instanceof AniListImportError || err instanceof Error
          ? err.message
          : "Échec de l'import V2.",
      );
    }
  };

  const handleResume = async () => {
    if (!resumeId) return;
    setPhase("processing");
    setBatchId(resumeId);
    try {
      await pollUntilDone(resumeId);
      await loadPreview(resumeId);
      setResumeId(null);
    } catch (err) {
      setPhase("idle");
      toast.error(err instanceof Error ? err.message : "Reprise impossible.");
    }
  };

  // Note: no manual "Retry" action. Transient errors (rate_limited / timeout /
  // unavailable) are auto-retried by the server worker via lock release and an
  // attempt counter. An item that surfaces to the UI as `failed` is terminal
  // (provider_not_found / provider_id_mismatch / invalid_canonical_payload)
  // and cannot be recovered by re-polling. See G.6D contract.
  const handleRefreshState = async () => {
    if (!batchId) return;
    try {
      await loadPreview(batchId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Actualisation impossible.");
    }
  };



  const handleSkipFailed = async () => {
    if (!batchId) return;
    const failed = items.filter((i) => i.status === "failed").map((i) => i.id);
    if (failed.length === 0) return;
    try {
      await skipFailed({ data: { batchId, itemIds: failed } });
      await loadPreview(batchId);
      toast.success(`${failed.length} item(s) ignoré(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ignorer impossible.");
    }
  };

  // Prevent double-click on confirm/rollback.
  const confirmingRef = useRef(false);
  const rollbackingRef = useRef(false);

  const handleConfirm = async () => {
    if (!batchId || confirmingRef.current) return;
    confirmingRef.current = true;
    try {
      const res = (await confirmBatch({ data: { batchId } })) as {
        created?: number;
        updated?: number;
        skipped?: number;
      };
      setSummary({
        created: Number(res.created ?? 0),
        updated: Number(res.updated ?? 0),
        skipped: Number(res.skipped ?? 0),
      });
      setPhase("confirmed");
      persistBatch(null);
      toast.success("Import canonique confirmé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Confirmation impossible.");
    } finally {
      confirmingRef.current = false;
    }
  };

  const handleRollback = async () => {
    if (!batchId || rollbackingRef.current) return;
    if (!window.confirm("Annuler cet import canonique ?")) return;
    rollbackingRef.current = true;
    try {
      const res = (await rollbackBatch({ data: { batchId } })) as { reverted?: number };
      toast.success(`Import annulé : ${res.reverted ?? 0} entrée(s) restaurée(s).`);
      setPhase("idle");
      setBatchId(null);
      setCounters(null);
      setItems([]);
      setSummary(null);
      persistBatch(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Annulation impossible.");
    } finally {
      rollbackingRef.current = false;
    }
  };

  const busy = phase === "fetching" || phase === "creating" || phase === "processing";
  const total = counters?.total ?? 0;
  const done =
    (counters?.canonical_count ?? 0) + (counters?.failed_count ?? 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const canonicalCount = items.filter((i) => i.status === "canonical").length;
  const canConfirm = Boolean(counters?.canonical_count && !failedCount && phase === "preview");

  return (
    <section className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
      <header className="flex items-center gap-2">
        <Badge className="border-primary/40 bg-primary/15 text-primary">Canonique</Badge>
        <h2 className="text-lg font-semibold">Import AniList canonique</h2>
      </header>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Cette version enrichit chaque titre via une source canonique côté serveur.
        Aucune métadonnée du navigateur n'est écrite en base.
      </p>

      {resumeId && phase === "idle" && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span className="flex-1">Un import précédent est en cours. Reprendre ?</span>
          <Button size="sm" variant="outline" onClick={handleResume}>
            Reprendre
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              persistBatch(null);
              setResumeId(null);
            }}
          >
            Ignorer
          </Button>
        </div>
      )}

      {(phase === "idle" || phase === "confirmed") && (
        <form
          className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            void handleStart(username);
          }}
        >
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
            placeholder="Nom d'utilisateur AniList"
            aria-label="Nom d'utilisateur AniList"
            autoComplete="off"
            className="focus-ring flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <Button type="submit" disabled={busy || !username.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Récupérer ma liste
          </Button>
        </form>
      )}

      {busy && (
        <div className="space-y-2" data-testid="canonical-v2-progress">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {phase === "fetching" && "Récupération de la liste AniList…"}
            {phase === "creating" && "Préparation du lot…"}
            {phase === "processing" &&
              `Canonisation en cours — ${done} / ${total || "…"} (${pct}%)`}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-border/50" role="progressbar"
               aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}


      {phase === "preview" && items.length > 0 && (
        <div className="space-y-3" data-testid="canonical-v2-preview">

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total" value={total} />
            <Stat label="Canoniques" value={canonicalCount} tone="emerald" />
            <Stat label="Échecs" value={failedCount} tone={failedCount ? "amber" : undefined} />
            <Stat label="Statut" value={counters?.status ?? "—"} />
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="max-h-[26rem] overflow-y-auto divide-y divide-border">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{pickTitle(it.canonical_snapshot, it.provider_ref)}</p>
                    <p className="text-xs text-muted-foreground">
                      ord. {it.ordinal} · ref {it.provider_ref}
                      {it.error_code ? ` · ${it.error_code}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      it.status === "canonical"
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                        : it.status === "failed"
                          ? "border-amber-500/30 bg-amber-500/15 text-amber-400"
                          : "border-border text-muted-foreground"
                    }
                  >
                    {it.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleConfirm} disabled={!canConfirm || confirmingRef.current} data-testid="canonical-v2-confirm">
              <CheckCircle2 className="h-4 w-4" /> Confirmer {canonicalCount} entrée(s)
            </Button>
            {failedCount > 0 && (
              <>
                <Button variant="ghost" onClick={handleRefreshState} disabled={busy} data-testid="canonical-v2-refresh">
                  Actualiser l'état
                </Button>
                <Button variant="outline" onClick={handleSkipFailed} disabled={busy} data-testid="canonical-v2-skip">
                  Ignorer les {failedCount} échec(s)
                </Button>
              </>
            )}
          </div>
          {failedCount > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="canonical-v2-terminal-note">
              Ces éléments n'ont pas pu être récupérés automatiquement (erreur définitive côté source).
              Ignore-les pour pouvoir confirmer l'import.
            </p>
          )}

        </div>
      )}

      {phase === "confirmed" && summary && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4" data-testid="canonical-v2-summary">

          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
          <div className="flex-1">
            <p className="font-semibold">Import canonique terminé</p>
            <p className="text-sm text-muted-foreground">
              {summary.created} ajout(s), {summary.updated} mise(s) à jour, {summary.skipped} ignoré(s).
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRollback} disabled={rollbackingRef.current}>
            <Undo2 className="h-4 w-4" /> Annuler cet import
          </Button>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "emerald" | "amber";
}) {
  const toneClass =
    tone === "emerald" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3 text-center">
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
