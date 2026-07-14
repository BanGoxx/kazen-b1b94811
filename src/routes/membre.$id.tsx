import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  UserRound,
  Loader2,
  Lock,
  ListMusic,
  Star,
  Heart,
  Ban,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserBadges } from "@/lib/founder";
import { PublicBadgeList } from "@/components/founder/PublicBadge";
import { StartChatButton } from "@/components/chat/StartChatButton";
import {
  usePublicProfile,
  usePublicFavorites,
  useMemberBlock,
} from "@/lib/public-profile";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { formatDateLocalized } from "@/lib/i18n/date";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

export const Route = createFileRoute("/membre/$id")({
  head: () => ({
    meta: [
      { title: "Profil membre — KAZEN" },
      {
        name: "description",
        content: "Découvre le profil public d'un membre KAZEN : listes, avis et favoris partagés.",
      },
      { property: "og:title", content: "Profil membre — KAZEN" },
      {
        property: "og:description",
        content: "Découvre le profil public d'un membre KAZEN.",
      },
    ],
  }),
  component: PublicProfilePage,
});

function usePublicPlaylists(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["public-profile-playlists", id],
    enabled: enabled && !!id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, title, description")
        .eq("owner_id", id)
        .eq("is_public", true)
        .is("hidden_at", null)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

type ReviewRow = {
  id: string;
  media_source: string;
  media_external_id: string;
  body: string;
  rating: number | null;
  created_at: string;
  title?: string | null;
};

function usePublicReviews(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["public-profile-reviews", id],
    enabled: enabled && !!id,
    staleTime: 60_000,
    queryFn: async (): Promise<ReviewRow[]> => {
      const { data, error } = await supabase
        .from("fiche_reviews")
        .select("id, media_source, media_external_id, body, rating, created_at")
        .eq("user_id", id)
        .is("hidden_at", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as ReviewRow[];
      if (rows.length === 0) return rows;
      const keys = rows.map((r) => `${r.media_source}:${r.media_external_id}`);
      const { data: media } = await supabase
        .from("media_records")
        .select("media_key, title")
        .in("media_key", keys);
      const titleByKey = new Map(
        (media ?? []).map((m) => [m.media_key, m.title]),
      );
      return rows.map((r) => ({
        ...r,
        title: titleByKey.get(`${r.media_source}:${r.media_external_id}`) ?? null,
      }));
    },
  });
}

function PublicProfilePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { data: profile, isLoading } = usePublicProfile(id);
  const { data: badges } = useUserBadges(id);
  const blockMut = useMemberBlock(id);

  const showPlaylists = !!profile?.show_playlists && !profile?.is_blocked_by_me;
  const showReviews = !!profile?.show_reviews && !profile?.is_blocked_by_me;
  const showFavorites = !!profile?.show_favorites && !profile?.is_blocked_by_me;

  const { data: playlists } = usePublicPlaylists(
    id,
    !!profile?.exists && !profile?.hidden && showPlaylists,
  );
  const { data: reviews } = usePublicReviews(
    id,
    !!profile?.exists && !profile?.hidden && showReviews,
  );
  const { data: favorites } = usePublicFavorites(
    id,
    !!profile?.exists && !profile?.hidden && showFavorites,
  );

  if (isLoading) {
    return (
      <AppShell>
        <div className="section-container flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!profile?.exists) {
    return (
      <AppShell>
        <div className="section-container max-w-lg space-y-4 py-16 text-center">
          <UserRound className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold">{t.profile.publicNotFoundTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {t.profile.publicNotFoundBody}
          </p>
          <Button asChild variant="outline">
            <Link to="/">{t.common.backHome}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (profile.hidden) {
    return (
      <AppShell>
        <div className="section-container max-w-lg space-y-4 py-16 text-center">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold">{t.profile.publicPrivateTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {t.profile.publicPrivateBody}
          </p>
          <Button asChild variant="outline">
            <Link to="/">{t.common.backHome}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const memberSince = profile.member_since
    ? formatDateLocalized(profile.member_since, locale, {
        month: "long",
        year: "numeric",
      })
    : null;

  const toggleBlock = async () => {
    const next = !profile.is_blocked_by_me;
    try {
      await blockMut.mutateAsync(next);
      toast.success(next ? t.profile.publicBlocked : t.profile.publicUnblocked);
    } catch {
      toast.error(t.profile.publicBlockError);
    }
  };


  return (
    <AppShell>
      <div className="section-container max-w-3xl space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="aurora-bg text-white text-xl">
                {(profile.display_name ?? "N").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold">
                  {profile.display_name}
                </h1>
                {badges && badges.length > 0 ? (
                  <PublicBadgeList badges={badges} max={3} />
                ) : null}
              </div>
              {memberSince ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.profile.publicMemberSince} {memberSince}
                </p>
              ) : null}
              {profile.show_bio && profile.bio ? (
                <p className="mt-3 max-w-prose text-sm text-foreground/90">
                  {profile.bio}
                </p>
              ) : null}
            </div>
          </div>
          {!profile.is_self && user ? (
            <div className="flex flex-col items-end gap-2">
              {profile.chat_eligible && profile.id ? (
                <StartChatButton
                  targetUserId={profile.id}
                  targetName={profile.display_name}
                />
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
                disabled={blockMut.isPending}
                onClick={toggleBlock}
              >
                {profile.is_blocked_by_me ? (
                  <>
                    <ShieldOff className="h-4 w-4" /> {t.profile.publicUnblock}
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" /> {t.profile.publicBlock}
                  </>
                )}
              </Button>
            </div>
          ) : null}

        </header>

        {profile.is_blocked_by_me ? (
          <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Tu as bloqué ce membre. Son contenu et la messagerie sont masqués.
          </p>
        ) : null}

        {profile.show_stats && !profile.is_blocked_by_me ? (
          <section className="grid grid-cols-3 gap-3">
            <StatCard
              label="Listes"
              value={profile.playlists_count ?? 0}
              icon={<ListMusic className="h-4 w-4" />}
            />
            <StatCard
              label="Avis"
              value={profile.reviews_count ?? 0}
              icon={<Star className="h-4 w-4" />}
            />
            {profile.show_favorites ? (
              <StatCard
                label="Favoris"
                value={profile.favorites_count ?? 0}
                icon={<Heart className="h-4 w-4" />}
              />
            ) : null}
          </section>
        ) : null}

        {showFavorites && favorites && favorites.length > 0 ? (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Favoris</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {favorites.map((f) =>
                f.source && f.external_id ? (
                  <Link
                    key={f.media_key}
                    to="/media/$source/$id"
                    params={{ source: f.source, id: f.external_id }}
                    className="group space-y-1"
                  >
                    <div className="aspect-[2/3] overflow-hidden rounded-lg border border-border/60 bg-muted">
                      {f.poster_url ? (
                        <img
                          src={f.poster_url}
                          alt={f.title ?? ""}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground group-hover:text-foreground">
                      {f.title ?? "Titre"}
                    </p>
                  </Link>
                ) : null,
              )}
            </div>
          </section>
        ) : null}

        {showPlaylists && playlists && playlists.length > 0 ? (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Listes partagées</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {playlists.map((pl) => (
                <Link
                  key={pl.id}
                  to="/playlist/$id"
                  params={{ id: pl.id }}
                  className="rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40"
                >
                  <p className="font-medium">{pl.title}</p>
                  {pl.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {pl.description}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {showReviews && reviews && reviews.length > 0 ? (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Avis récents</h2>
            <div className="space-y-3">
              {reviews.map((r) => (
                <Link
                  key={r.id}
                  to="/media/$source/$id"
                  params={{ source: r.media_source, id: r.media_external_id }}
                  className="block rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{r.title ?? "Fiche"}</p>
                    {typeof r.rating === "number" ? (
                      <span className="flex items-center gap-1 text-sm text-primary">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {r.rating}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                    {r.body}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 text-center backdrop-blur">
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
