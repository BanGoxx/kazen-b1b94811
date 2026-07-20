import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  HelpCircle,
  Undo2,
  Trash2,
  Clock,
  Download,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PROVIDERS, toDbProvider, type ProviderDef, type ProviderId } from "@/lib/import/providers";
import { ImportParseError, type ImportEntry } from "@/lib/import/import-schema";
import { fetchAniListImport, AniListImportError } from "@/lib/import/anilist-list";
import {
  createImportBatch,
  getImportBatches,
  getImportPreview,
  confirmImport,
  rollbackImport,
  deleteImportBatch,
} from "@/lib/import.functions";
import { isCanonicalImportV2Enabled } from "@/lib/import-canonical-v2.functions";
import { CanonicalV2Import } from "@/components/import/CanonicalV2Import";
import { exportMyData } from "@/lib/export.functions";
import { toCsv, downloadFile, exportFileName } from "@/lib/export";


export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "Importer mes listes — KAZEN" },
      {
        name: "description",
        content:
          "Importez en toute sécurité vos listes d'anime, séries et films depuis d'autres plateformes vers KAZEN.",
      },
    ],
  }),
  component: ImportPage,
});

type PreviewItem = {
  id: string;
  raw_title: string;
  match_status: string;
  match_confidence: number;
  matched_media_key: string | null;
  user_status: string | null;
  user_score: number | null;
  progress: number | null;
  import_action: string;
};

type Preview = {
  items: PreviewItem[];
  summary: {
    total: number;
    exact: number;
    probable: number;
    needs_confirmation: number;
    unmatched: number;
    duplicate: number;
  };
};

const STATUS_STYLE: Record<string, string> = {
  exact: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  probable: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  needs_confirmation: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  duplicate: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  unmatched: "bg-muted text-muted-foreground border-border",
};
const STATUS_LABEL: Record<string, string> = {
  exact: "Correspondance sûre",
  probable: "Probable",
  needs_confirmation: "À confirmer",
  duplicate: "Déjà présent",
  unmatched: "Introuvable",
};

function ImportPage() {
  const create = useServerFn(createImportBatch);
  const preview = useServerFn(getImportPreview);
  const confirm = useServerFn(confirmImport);
  const rollback = useServerFn(rollbackImport);
  const del = useServerFn(deleteImportBatch);
  const listBatches = useServerFn(getImportBatches);

  const runExport = useServerFn(exportMyData);

  const [selected, setSelected] = useState<ProviderId | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Preview | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof getImportBatches>>>([]);

  const refreshBatches = async () => {
    try {
      setBatches(await listBatches());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void refreshBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setBatchId(null);
    setPreviewData(null);
    setChecked(new Set());
    setSummary(null);
  };

  const processEntries = async (
    provider: ProviderDef,
    entries: ImportEntry[],
    sourceMetadata: Record<string, unknown>,
  ) => {
    if (entries.length === 0) throw new Error("Aucune entrée détectée.");
    const { batchId: id, count, truncated, total } = await create({
      data: {
        provider: toDbProvider(provider.id),
        sourceMetadata,
        entries,
      },
    });
    setBatchId(id);
    const pv = await preview({ data: { batchId: id } });
    setPreviewData(pv as Preview);
    // Pre-check safe (exact) matches.
    setChecked(
      new Set((pv.items as PreviewItem[]).filter((i) => i.match_status === "exact").map((i) => i.id)),
    );
    await refreshBatches();
    if (truncated) {
      toast.warning(
        `Liste très longue : seules les ${count} premières entrées sur ${total} ont été importées.`,
      );
    }
    toast.success(`${count} entrées analysées.`);
  };

  const handleFile = async (provider: ProviderDef, file: File) => {
    setBusy(true);
    reset();
    try {
      const text = await file.text();
      let entries: ImportEntry[];
      try {
        entries = provider.parse(text).map((e) => ({ ...e, provider: e.provider }));
      } catch (err) {
        if (err instanceof ImportParseError) throw new Error(err.message);
        throw err;
      }
      if (entries.length === 0) throw new Error("Aucune entrée détectée dans ce fichier.");
      await processEntries(provider, entries, { fileName: file.name, providerId: provider.id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'analyse du fichier.");
    } finally {
      setBusy(false);
    }
  };

  const handleUsername = async (provider: ProviderDef, username: string) => {
    setBusy(true);
    reset();
    try {
      const { entries, warnings } = await fetchAniListImport(username);
      for (const w of warnings) toast.message(w);
      await processEntries(provider, entries, { username: username.trim(), providerId: provider.id });
    } catch (err) {
      toast.error(
        err instanceof AniListImportError || err instanceof Error
          ? err.message
          : "Échec de la récupération de la liste AniList.",
      );
    } finally {
      setBusy(false);
    }
  };


  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!batchId) return;
    setBusy(true);
    try {
      const res = await confirm({ data: { batchId, confirmItemIds: [...checked] } });
      setSummary(res);
      setPreviewData(null);
      await refreshBatches();
      toast.success(`Import terminé : ${res.created} créés, ${res.updated} mis à jour.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'import.");
    } finally {
      setBusy(false);
    }
  };

  const handleRollback = async (id: string) => {
    if (
      !window.confirm(
        "Annuler cet import ? Les titres ajoutés par cet import seront retirés et les titres modifiés seront restaurés à leur état précédent. Le reste de ta liste n'est pas affecté.",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await rollback({ data: { batchId: id } });
      await refreshBatches();
      toast.success(`Import annulé : ${res.reverted} entrées restaurées.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'annulation.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Supprimer ce lot d'import de l'historique ? Cela n'annule pas les titres déjà importés dans ta liste (utilise « Annuler » pour cela). Seul l'historique de ce lot est effacé.",
      )
    )
      return;
    setBusy(true);
    try {
      await del({ data: { batchId: id } });
      await refreshBatches();
      toast.success("Lot d'import supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la suppression.");
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    setExporting(format);
    try {
      const payload = await runExport();
      if (format === "json") {
        downloadFile(
          JSON.stringify(payload, null, 2),
          exportFileName("json"),
          "application/json",
        );
      } else {
        downloadFile(toCsv(payload), exportFileName("csv"), "text/csv;charset=utf-8");
      }
      toast.success(
        payload.count === 0
          ? "Export généré (liste vide)."
          : `${payload.count} entrée(s) exportée(s) en ${format.toUpperCase()}.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'export.");
    } finally {
      setExporting(null);
    }
  };



  const confirmableCount = previewData
    ? previewData.items.filter((i) => i.match_status !== "unmatched" && i.match_status !== "duplicate").length
    : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Importer mes listes</h1>
          <p className="max-w-2xl text-muted-foreground">
            Rapatrie ta liste personnelle depuis une autre plateforme vers KAZEN. Aucun mot de
            passe, cookie ni scraping : tu fournis toi-même un fichier exporté, KAZEN prévisualise
            les correspondances, et rien n'est écrit dans ta liste sans ta confirmation.
          </p>
        </header>

        {/* Privacy banner */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-4 text-sm text-muted-foreground">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Confidentialité : KAZEN n'importe que tes propres métadonnées de suivi (titre, statut,
            note, progression). Tu peux annuler ou supprimer un import à tout moment.
          </p>
        </div>

        {/* Provider selection */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Choisis une source</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDERS.map((p) => {
              const isSel = selected === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!p.available}
                  onClick={() => {
                    setSelected(p.id);
                    reset();
                  }}
                  className={`focus-ring flex flex-col gap-1 rounded-xl border p-4 text-left transition ${
                    isSel ? "border-primary bg-primary/5" : "border-border bg-card/50"
                  } ${p.available ? "hover:border-primary/60" : "cursor-not-allowed opacity-55"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{p.label}</span>
                    {p.available ? (
                      p.experimental ? (
                        <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-400">
                          Expérimental
                        </Badge>
                      ) : (
                        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
                          Disponible
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Bientôt disponible
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{p.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Upload */}
        {selected && (
          <UploadSection
            provider={PROVIDERS.find((p) => p.id === selected)!}
            busy={busy}
            onFile={handleFile}
            onUsername={handleUsername}
          />

        )}

        {/* Preview */}
        {previewData && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">3. Aperçu avant import</h2>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-4 text-sm text-muted-foreground">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                KAZEN compare les titres avec son catalogue actuel. Vérifiez les correspondances
                avant de confirmer.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <SummaryStat label="Total" value={previewData.summary.total} />
              <SummaryStat label="Sûres" value={previewData.summary.exact} tone="emerald" />
              <SummaryStat label="Probables" value={previewData.summary.probable} tone="amber" />
              <SummaryStat label="À confirmer" value={previewData.summary.needs_confirmation} tone="amber" />
              <SummaryStat label="Déjà présent" value={previewData.summary.duplicate} tone="sky" />
              <SummaryStat label="Introuvables" value={previewData.summary.unmatched} />
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="max-h-[26rem] overflow-y-auto divide-y divide-border">
                {previewData.items.map((it) => {
                  const selectable =
                    it.match_status !== "unmatched" && it.match_status !== "duplicate";
                  return (
                    <div key={it.id} className="flex items-center gap-3 p-3">
                      <Checkbox
                        checked={checked.has(it.id)}
                        disabled={!selectable}
                        onCheckedChange={() => toggle(it.id)}
                        aria-label={`Importer ${it.raw_title}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{it.raw_title}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.user_status ?? "—"}
                          {it.user_score != null ? ` · note ${it.user_score}` : ""}
                          {it.progress != null ? ` · ${it.progress} ép.` : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={STATUS_STYLE[it.match_status] ?? STATUS_STYLE.unmatched}
                      >
                        {STATUS_LABEL[it.match_status] ?? it.match_status}
                        {it.match_confidence > 0 ? ` ${Math.round(it.match_confidence * 100)}%` : ""}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-muted-foreground">
                Confirmer ajoutera ou mettra à jour{" "}
                <span className="font-semibold text-foreground">{checked.size} titre(s)</span> dans ta
                liste personnelle KAZEN. Les titres introuvables et les doublons sont ignorés
                automatiquement, et les cases décochées ne seront pas importées. Tout import reste
                annulable depuis l'historique.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleConfirm} disabled={busy || checked.size === 0}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Importer {checked.size} entrée(s)
              </Button>
              <Button variant="ghost" onClick={reset} disabled={busy}>
                Annuler
              </Button>
              <span className="text-xs text-muted-foreground">
                {confirmableCount} entrée(s) importables · les introuvables et doublons sont ignorés.
              </span>
            </div>
          </section>
        )}

        {/* Confirmation summary */}
        {summary && (
          <section className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
            <div>
              <p className="font-semibold">Import terminé</p>
              <p className="text-sm text-muted-foreground">
                {summary.created} ajout(s), {summary.updated} mise(s) à jour, {summary.skipped} ignoré(s).
                Tu peux annuler cet import depuis l'historique ci-dessous.
              </p>
            </div>
          </section>
        )}

        {/* History */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Historique des imports</h2>
            <Button variant="ghost" size="sm" onClick={refreshBatches}>
              Actualiser
            </Button>
          </div>
          {batches.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Aucun import pour le moment.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {batches.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center gap-3 p-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium capitalize">{b.provider.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleString("fr-FR")} · statut : {b.status}
                    </p>
                  </div>
                  {b.status === "completed" && (
                    <Button variant="outline" size="sm" onClick={() => handleRollback(b.id)} disabled={busy}>
                      <Undo2 className="h-4 w-4" /> Annuler l'import
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(b.id)}
                    disabled={busy}
                    aria-label="Supprimer ce lot de l'historique"
                  >
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Export */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Exporter mes données</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Téléchargez une copie de vos listes KAZEN en JSON ou CSV. L'export ne contient que vos
            propres données de suivi (titres, statuts, notes, progression, dates, tags).
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => handleExport("json")}
              disabled={exporting !== null}
            >
              {exporting === "json" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4" />
              )}
              Exporter en JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport("csv")}
              disabled={exporting !== null}
            >
              {exporting === "csv" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Exporter en CSV
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Download className="h-3.5 w-3.5" /> Le fichier JSON peut être réimporté dans KAZEN.
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function UploadSection({
  provider,
  busy,
  onFile,
  onUsername,
}: {
  provider: ProviderDef;
  busy: boolean;
  onFile: (p: ProviderDef, f: File) => void;
  onUsername: (p: ProviderDef, username: string) => void;
}) {
  const [username, setUsername] = useState("");
  if (!provider.available) {
    return (
      <section className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        <AlertTriangle className="mb-2 h-5 w-5 text-amber-400" />
        L'import {provider.label} arrive prochainement. Sélectionne une source disponible.
      </section>
    );
  }
  const heading = provider.usernameBased ? "2. Renseigne ton nom d'utilisateur" : "2. Téléverse ton fichier";
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{heading}</h2>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Copy className="mt-0.5 h-4 w-4 shrink-0" /> {provider.howto}
      </p>
      {provider.notes && provider.notes.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-border bg-card/50 p-4 text-sm text-muted-foreground">
          {provider.notes.map((n) => (
            <li key={n} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              {n}
            </li>
          ))}
        </ul>
      )}
      {provider.usernameBased ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (username.trim() && !busy) onUsername(provider, username);
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
      ) : (
        <label className="focus-within:ring-2 focus-within:ring-primary/60 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center transition hover:border-primary/60">
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <Upload className="h-6 w-6 text-primary" />
          )}
          <span className="font-medium">Choisir un fichier {provider.label}</span>
          <span className="text-xs text-muted-foreground">{provider.accept}</span>
          <input
            type="file"
            accept={provider.accept}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(provider, f);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </section>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber" | "sky";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "amber"
        ? "text-amber-400"
        : tone === "sky"
          ? "text-sky-400"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3 text-center">
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
