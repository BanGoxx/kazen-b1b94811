import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Loader2, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  updateMyEmailPreferences,
  markDigestPreviewed,
  DEFAULT_EMAIL_PREFERENCES,
  type EmailPreferences,
  type DigestFrequency,
} from "@/lib/email-prefs.functions";
import {
  useEmailPreferences,
  useGeneralDigest,
  usePersonalizedDigest,
} from "@/lib/use-digest";
import { DigestPreview } from "@/components/digest/DigestPreview";

const CONTENT_TYPES: { value: string; label: string }[] = [
  { value: "anime", label: "Anime" },
  { value: "films", label: "Films" },
  { value: "series", label: "Séries" },
  { value: "articles", label: "Articles" },
];

const FREQUENCIES: { value: DigestFrequency; label: string }[] = [
  { value: "weekly", label: "Hebdomadaire" },
  { value: "monthly", label: "Mensuelle" },
  { value: "never", label: "Jamais" },
];

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function EmailPreferences() {
  const { data, isLoading, refetch } = useEmailPreferences();
  const updateFn = useServerFn(updateMyEmailPreferences);
  const markPreviewFn = useServerFn(markDigestPreviewed);
  const queryClient = useQueryClient();

  const [prefs, setPrefs] = useState<EmailPreferences>(DEFAULT_EMAIL_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (data) setPrefs(data);
  }, [data]);

  const general = useGeneralDigest(showPreview ? prefs : undefined);
  const personalized = usePersonalizedDigest(showPreview ? prefs : undefined);

  const set = <K extends keyof EmailPreferences>(key: K, value: EmailPreferences[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const frequencyDisabled = false;

  const save = async () => {
    setSaving(true);
    try {
      await updateFn({
        data: {
          receive_general_digest: prefs.receive_general_digest,
          receive_personalized_digest: prefs.receive_personalized_digest,
          digest_frequency: prefs.digest_frequency,
          preferred_content_types: prefs.preferred_content_types,
          include_upcoming: prefs.include_upcoming,
          include_articles: prefs.include_articles,
          include_recommendations: prefs.include_recommendations,
        },
      });
      await refetch();
      toast.success("Préférences email enregistrées.");
    } catch {
      toast.error("Impossible d'enregistrer vos préférences.");
    } finally {
      setSaving(false);
    }
  };

  const disableAll = async () => {
    const next: EmailPreferences = {
      ...prefs,
      receive_general_digest: false,
      receive_personalized_digest: false,
      digest_frequency: "never",
    };
    setPrefs(next);
    setSaving(true);
    try {
      await updateFn({
        data: {
          receive_general_digest: false,
          receive_personalized_digest: false,
          digest_frequency: "never",
        },
      });
      await refetch();
      toast.success("Tous les emails ont été désactivés.");
    } catch {
      toast.error("Action impossible pour le moment.");
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async () => {
    setShowPreview(true);
    queryClient.invalidateQueries({ queryKey: ["email-preferences"] });
    try {
      await markPreviewFn();
    } catch {
      /* preview timestamp is best-effort; never block the preview */
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-card/40 p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des préférences email…
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card/40 p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl aurora-bg text-white shadow-glow">
          <Mail className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold">Préférences email</h2>
          <p className="text-sm text-muted-foreground">
            Choisissez les actualités, sorties et recommandations que vous souhaitez recevoir.
            Aucun email ne sera envoyé sans votre accord.
          </p>
        </div>
      </div>

      {/* Opt-ins (never pre-checked beyond saved state) */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 p-4">
          <div>
            <Label htmlFor="general-digest" className="text-sm font-semibold">
              Recevoir le digest général KAZEN
            </Label>
            <p className="text-xs text-muted-foreground">
              Sorties à venir, tendances et actualités de la rédaction.
            </p>
          </div>
          <Switch
            id="general-digest"
            checked={prefs.receive_general_digest}
            onCheckedChange={(v) => set("receive_general_digest", v)}
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 p-4">
          <div>
            <Label htmlFor="perso-digest" className="text-sm font-semibold">
              Recevoir mon digest personnalisé « Pour vous »
            </Label>
            <p className="text-xs text-muted-foreground">
              Recommandations adaptées à vos listes, notes et genres préférés.
            </p>
          </div>
          <Switch
            id="perso-digest"
            checked={prefs.receive_personalized_digest}
            onCheckedChange={(v) => set("receive_personalized_digest", v)}
          />
        </div>
      </div>

      {/* Frequency */}
      <fieldset className="space-y-2" disabled={frequencyDisabled}>
        <legend className="text-sm font-semibold">Fréquence</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Fréquence des emails">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={prefs.digest_frequency === f.value}
              onClick={() => set("digest_frequency", f.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                prefs.digest_frequency === f.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {prefs.digest_frequency === "never" ? (
          <p className="text-xs text-muted-foreground">
            La fréquence « Jamais » désactive tout envoi, même si un digest est activé.
          </p>
        ) : null}
      </fieldset>

      {/* Content types */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Contenus</Label>
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.map((c) => {
            const active = prefs.preferred_content_types.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  set("preferred_content_types", toggleValue(prefs.preferred_content_types, c.value))
                }
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section toggles */}
      <div className="space-y-3">
        <ToggleRow
          id="inc-upcoming"
          label="Inclure les sorties à venir"
          checked={prefs.include_upcoming}
          onChange={(v) => set("include_upcoming", v)}
        />
        <ToggleRow
          id="inc-recos"
          label="Inclure les recommandations"
          checked={prefs.include_recommendations}
          onChange={(v) => set("include_recommendations", v)}
        />
        <ToggleRow
          id="inc-articles"
          label="Inclure les articles récents"
          checked={prefs.include_articles}
          onChange={(v) => set("include_articles", v)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <Button variant="ghost" size="sm" onClick={disableAll} disabled={saving}>
          Tout désactiver
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={openPreview}>
            <Eye className="h-4 w-4" /> Prévisualiser mon digest
          </Button>
          <Button variant="aurora" size="sm" className="gap-2" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer
          </Button>
        </div>
      </div>

      {showPreview ? (
        <div className="space-y-6 border-t border-border/60 pt-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Aperçu de vos digests
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Digest général
            </p>
            <DigestPreview
              model={general.model}
              isLoading={general.isLoading}
              providerFailed={general.providerFailed}
              onRetry={() => queryClient.invalidateQueries()}
              contextLabel="Digest général"
            />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Digest personnalisé « Pour vous »
            </p>
            <DigestPreview
              model={personalized.model}
              isLoading={personalized.isLoading}
              providerFailed={personalized.providerFailed}
              contextLabel="Digest personnalisé"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
