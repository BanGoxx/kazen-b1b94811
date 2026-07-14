import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getMyProfile, updateMyProfile } from "@/lib/list.functions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type PrivacyKey =
  | "profile_public"
  | "show_bio"
  | "show_playlists"
  | "show_reviews"
  | "show_favorites"
  | "show_stats";

const ROWS: { key: PrivacyKey; title: string; desc: string }[] = [
  {
    key: "profile_public",
    title: "Profil public",
    desc: "Rendre ta page profil visible par les autres membres et visiteurs.",
  },
  {
    key: "show_bio",
    title: "Afficher ta bio",
    desc: "Montrer ta présentation sur ta page publique.",
  },
  {
    key: "show_stats",
    title: "Afficher tes statistiques",
    desc: "Montrer le nombre de listes, avis et favoris.",
  },
  {
    key: "show_playlists",
    title: "Afficher tes listes partagées",
    desc: "Montrer tes listes publiques sur ton profil.",
  },
  {
    key: "show_reviews",
    title: "Afficher tes avis",
    desc: "Montrer tes avis publics sur ton profil.",
  },
  {
    key: "show_favorites",
    title: "Afficher tes favoris",
    desc: "Partager une sélection de tes titres favoris (masqué par défaut).",
  },
];

const DEFAULTS: Record<PrivacyKey, boolean> = {
  profile_public: true,
  show_bio: true,
  show_playlists: true,
  show_reviews: true,
  show_favorites: false,
  show_stats: true,
};

/** Member privacy controls for the public profile page. */
export function ProfilePrivacy() {
  const { user } = useAuth();
  const load = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);
  const [values, setValues] = useState<Record<PrivacyKey, boolean>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<PrivacyKey | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) return;
    load()
      .then((data) => {
        if (active && data) {
          setValues({
            profile_public: data.profile_public ?? true,
            show_bio: data.show_bio ?? true,
            show_playlists: data.show_playlists ?? true,
            show_reviews: data.show_reviews ?? true,
            show_favorites: data.show_favorites ?? false,
            show_stats: data.show_stats ?? true,
          });
        }
        if (active) setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, load]);

  const onToggle = async (key: PrivacyKey, next: boolean) => {
    setValues((v) => ({ ...v, [key]: next }));
    setSavingKey(key);
    try {
      await save({ data: { [key]: next } });
    } catch {
      setValues((v) => ({ ...v, [key]: !next }));
      toast.error("La préférence n'a pas pu être enregistrée.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section
      id="confidentialite"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Confidentialité du profil</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Ton nom et ton avatar restent visibles là où tu publies (avis, listes,
        communauté). Ces réglages contrôlent ta page profil publique.
      </p>
      <div className="divide-y divide-border/60">
        {ROWS.map((row) => {
          const disabledByParent = row.key !== "profile_public" && !values.profile_public;
          return (
            <div key={row.key} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <Label htmlFor={`priv-${row.key}`} className="text-sm font-medium">
                  {row.title}
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">{row.desc}</p>
              </div>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  id={`priv-${row.key}`}
                  checked={values[row.key]}
                  disabled={savingKey === row.key || disabledByParent}
                  onCheckedChange={(next) => onToggle(row.key, next)}
                  aria-label={row.title}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
