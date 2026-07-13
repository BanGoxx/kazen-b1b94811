import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Loader2, UserRound, Crown, Sparkles, Wand2, Heart } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { getMyProfile, updateMyProfile } from "@/lib/list.functions";
import { useMyList } from "@/lib/use-list";
import { signOut, useAuth } from "@/lib/auth";
import { usePremium } from "@/lib/premium";
import { SupporterBadge } from "@/components/premium/SupporterBadge";
import { FounderBadge } from "@/components/founder/FounderBadge";
import { PublicBadgeList } from "@/components/founder/PublicBadge";
import { useIsOwner, useUserBadges } from "@/lib/founder";
import { RecommendationAssistant } from "@/components/media/RecommendationAssistant";
import { EmailPreferences } from "@/components/settings/EmailPreferences";
import { NotificationPreferences } from "@/components/settings/NotificationPreferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

const GENRE_OPTIONS = [
  "Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science-Fiction",
  "Romance", "Thriller", "Mystère", "Horreur", "Surnaturel", "Psychologique",
  "Sport", "Mecha", "Tranche de vie", "Musique",
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "anime", label: "Anime" },
  { value: "series", label: "Séries" },
  { value: "movie", label: "Films" },
];

const STYLE_OPTIONS = [
  "Shonen", "Seinen", "Shojo", "Isekai", "Slice of life", "Dark",
  "Feel-good", "Épique", "Émotionnel", "Cérébral",
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [{ title: "Mon profil — KAZEN" }],
  }),
  component: ProfilePage,
});


function ProfilePage() {
  const { user } = useAuth();
  const { isSupporter } = usePremium();
  const isOwner = useIsOwner();
  const { data: myBadges } = useUserBadges(user?.id);
  const navigate = useNavigate();
  const updateFn = useServerFn(updateMyProfile);
  const { entries } = useMyList();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
  });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setDisplayName(data.display_name ?? "");
      setBio(data.bio ?? "");
      setGenres((data.preferred_genres as string[] | null) ?? []);
      setTypes((data.preferred_types as string[] | null) ?? []);
      setStyles((data.favorite_styles as string[] | null) ?? []);
    }
  }, [data]);

  const rated = entries.filter((e) => typeof e.rating === "number");
  const stats = {
    total: entries.length,
    favoris: entries.filter((e) => e.favorite).length,
    termine: entries.filter((e) => e.status === "termine").length,
    en_cours: entries.filter((e) => e.status === "en_cours").length,
  };
  const insights = {
    avgRating:
      rated.length > 0
        ? (rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length).toFixed(1)
        : null,
    episodes: entries.reduce((sum, e) => sum + (e.progress ?? 0), 0),
    rewatches: entries.reduce((sum, e) => sum + (e.rewatchCount ?? 0), 0),
    aVoir: entries.filter((e) => e.status === "a_voir").length,
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateFn({
        data: {
          display_name: displayName,
          bio,
          preferred_genres: genres,
          preferred_types: types,
          favorite_styles: styles,
        },
      });
      await refetch();
      toast.success("Profil mis à jour.");
    } catch {
      toast.error("Impossible d'enregistrer le profil.");
    } finally {
      setSaving(false);
    }
  };


  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <AppShell>
      <div className="section-container max-w-3xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={data?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="aurora-bg text-white">
                {(displayName || user?.email || "N").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold">
                  {displayName || "Mon profil"}
                </h1>
                {isOwner ? <FounderBadge size="sm" /> : null}
                {isSupporter ? <SupporterBadge size="sm" /> : null}
                {myBadges && myBadges.length > 0 ? (
                  <PublicBadgeList badges={myBadges} max={3} />
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="premium" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Déconnexion
          </Button>
        </header>

        {/* Couche Soutien / Premium */}
        {isSupporter ? (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl aurora-bg text-white shadow-glow">
                <Crown className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-bold">Membre Soutien</p>
                <p className="text-sm text-muted-foreground">
                  Merci de faire vivre KAZEN 💜
                </p>
              </div>
            </div>
            <Button asChild variant="premium" size="sm">
              <Link to="/soutien">Gérer</Link>
            </Button>
          </section>
        ) : (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-bold">Passe au Soutien</p>
                <p className="text-sm text-muted-foreground">
                  Filtres avancés, rappels, stats détaillées et badge exclusif.
                </p>
              </div>
            </div>
            <Button asChild variant="aurora" size="sm">
              <Link to="/soutien">Découvrir</Link>
            </Button>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Suivis", value: stats.total },
            { label: "En cours", value: stats.en_cours },
            { label: "Terminés", value: stats.termine },
            { label: "Favoris", value: stats.favoris },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-card/60 p-4 text-center backdrop-blur"
            >
              <p className="font-display text-2xl font-extrabold aurora-text">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {entries.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "À voir", value: insights.aVoir },
              { label: "Épisodes suivis", value: insights.episodes },
              { label: "Revisionnages", value: insights.rewatches },
              { label: "Note moyenne", value: insights.avgRating ?? "—" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border/70 bg-card/40 p-4 text-center backdrop-blur"
              >
                <p className="font-display text-2xl font-extrabold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        ) : null}


        <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <UserRound className="h-5 w-5" /> Informations
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Nom d'affichage</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Votre pseudo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="resize-none"
                  placeholder="Parlez de vos goûts…"
                />
              </div>
            </>
          )}
        </section>

        {/* Préférences de goût — alimentent les recommandations « Pour vous » */}
        <section className="space-y-6 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Heart className="h-5 w-5 text-primary" /> Mes préférences
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sélectionne tes goûts pour affiner tes recommandations personnalisées.
            </p>
          </div>

          <div className="space-y-3">
            <Label>Types préférés</Label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((t) => (
                <Chip
                  key={t.value}
                  active={types.includes(t.value)}
                  onClick={() => setTypes((prev) => toggle(prev, t.value))}
                >
                  {t.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Genres préférés</Label>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((g) => (
                <Chip
                  key={g}
                  active={genres.includes(g)}
                  onClick={() => setGenres((prev) => toggle(prev, g))}
                >
                  {g}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Styles favoris</Label>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((s) => (
                <Chip
                  key={s}
                  active={styles.includes(s)}
                  onClick={() => setStyles((prev) => toggle(prev, s))}
                >
                  {s}
                </Chip>
              ))}
            </div>
          </div>
        </section>

        {/* Aperçu recommandations + assistant */}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl aurora-bg text-white shadow-glow">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold">Pour vous</p>
              <p className="text-sm text-muted-foreground">
                Des suggestions adaptées à tes goûts et à ton historique.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RecommendationAssistant
              trigger={
                <Button variant="outline" size="sm" className="gap-2">
                  <Wand2 className="h-4 w-4" /> Assistant
                </Button>
              }
            />
            <Button asChild variant="aurora" size="sm">
              <Link to="/pour-vous">Voir</Link>
            </Button>
          </div>
        </section>

        {/* Préférences des notifications in-app (Phase 1) */}
        <section
          id="notifications"
          className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur"
        >
          <NotificationPreferences />
        </section>

        {/* Préférences email + aperçu digest (Phase 1 — aucun envoi) */}
        <EmailPreferences />


        <div className="flex justify-end">

          <Button variant="aurora" onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

