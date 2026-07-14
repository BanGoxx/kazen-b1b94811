import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getMyProfile, updateMyProfile } from "@/lib/list.functions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

type PrivacyKey =
  | "profile_public"
  | "show_bio"
  | "show_playlists"
  | "show_reviews"
  | "show_favorites"
  | "show_stats";

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
  const { t } = useI18n();
  const load = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);
  const [values, setValues] = useState<Record<PrivacyKey, boolean>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<PrivacyKey | null>(null);

  const rows = useMemo<{ key: PrivacyKey; title: string; desc: string }[]>(
    () => [
      { key: "profile_public", title: t.profile.privacyProfilePublic, desc: t.profile.privacyProfilePublicDesc },
      { key: "show_bio", title: t.profile.privacyShowBio, desc: t.profile.privacyShowBioDesc },
      { key: "show_stats", title: t.profile.privacyShowStats, desc: t.profile.privacyShowStatsDesc },
      { key: "show_playlists", title: t.profile.privacyShowPlaylists, desc: t.profile.privacyShowPlaylistsDesc },
      { key: "show_reviews", title: t.profile.privacyShowReviews, desc: t.profile.privacyShowReviewsDesc },
      { key: "show_favorites", title: t.profile.privacyShowFavorites, desc: t.profile.privacyShowFavoritesDesc },
    ],
    [t],
  );

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
      toast.error(t.profile.privacySaveError);
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
        <h2 className="font-display text-lg font-semibold">{t.profile.privacyTitle}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{t.profile.privacyIntro}</p>
      <div className="divide-y divide-border/60">
        {rows.map((row) => {
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

