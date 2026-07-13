import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Undo2 } from "lucide-react";
import { MediaCarousel } from "./MediaCarousel";
import { RecommendationAssistant } from "./RecommendationAssistant";
import { Button } from "@/components/ui/button";
import {
  useCandidatePool,
  useTasteProfile,
  useRecoFeedback,
} from "@/lib/use-recommendations";
import { useMyList } from "@/lib/use-list";
import { useAuth } from "@/lib/auth";
import {
  rankForYouAnimeFirst,
  rankByGenre,
  rankFreshForYou,
  rankDiscovery,
} from "@/lib/recommend";
import type { MediaItem } from "@/lib/media-types";

export function ForYouRails() {
  const { pool: rawPool, isLoading } = useCandidatePool();
  const profile = useTasteProfile();
  const { entries } = useMyList();
  const { user, ready } = useAuth();
  const { hiddenKeys, canHide, hideItem, restore, entries: hiddenEntries } = useRecoFeedback();

  // Drop dismissed titles from the ranking pool so they never resurface.
  const pool = useMemo<MediaItem[]>(
    () => (hiddenKeys.size ? rawPool.filter((m) => !hiddenKeys.has(m.key)) : rawPool),
    [rawPool, hiddenKeys],
  );

  const onHideItem = canHide ? (item: MediaItem) => hideItem(item.key) : undefined;

  const forYou = useMemo<MediaItem[]>(
    () => rankForYouAnimeFirst(pool, profile, { limit: 24 }).map((s) => s.item),
    [pool, profile],
  );

  // "Reprendre selon vos goûts": in-progress / paused titles, most recent first.
  const resume = useMemo<MediaItem[]>(
    () =>
      entries
        .filter((e) => (e.status === "en_cours" || e.status === "en_pause") && e.item)
        .map((e) => e.item as MediaItem),
    [entries],
  );

  const anchorGenre = profile.topGenres[0] ?? null;
  const anchorGenre2 = profile.topGenres[1] ?? null;

  const becauseYouLike = useMemo(
    () => (anchorGenre ? rankByGenre(pool, profile, anchorGenre, 20) : []),
    [pool, profile, anchorGenre],
  );
  const becauseYouLike2 = useMemo(
    () => (anchorGenre2 ? rankByGenre(pool, profile, anchorGenre2, 20) : []),
    [pool, profile, anchorGenre2],
  );
  const freshForYou = useMemo(() => rankFreshForYou(pool, profile, 20), [pool, profile]);
  const discovery = useMemo(() => rankDiscovery(pool, profile, 20), [pool, profile]);


  const isCold = profile.signalCount === 0;
  const showSignIn = ready && !user;

  return (
    <div className="space-y-12">
      {/* Cold-start / guest invitation — discreet, non-blocking. */}
      {(isCold || showSignIn) && (
        <div className="card-elevated flex flex-col items-start gap-3 rounded-2xl border border-border bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {showSignIn ? "Personnalisez votre expérience" : "Vos recommandations s'affinent"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {showSignIn
                ? "Connectez-vous et ajoutez des titres à vos listes : « Pour vous » s'adaptera à vos goûts."
                : "Ajoutez des favoris, des notes et des statuts — les suggestions deviennent plus justes à chaque interaction."}
            </p>
          </div>
          {showSignIn ? (
            <Button asChild variant="secondary" className="shrink-0">
              <Link to="/auth" search={{ redirect: "/pour-vous" }}>Se connecter</Link>
            </Button>
          ) : (
            <Button asChild variant="secondary" className="shrink-0">
              <Link to="/mes-listes">Ma liste</Link>
            </Button>
          )}
        </div>
      )}

      <MediaCarousel
        title="Pour vous"
        subtitle={
          isCold
            ? "Une sélection de qualité pour démarrer — elle s'adaptera à vos goûts"
            : "Un équilibre entre vos affinités et ce qui est fort en ce moment"
        }
        items={forYou}
        isLoading={isLoading && !forYou.length}
        onHideItem={onHideItem}
      />

      {resume.length > 0 && (
        <MediaCarousel
          title="Reprendre selon vos goûts"
          subtitle="Vos titres en cours et en pause"
          action={{ label: "Ma liste", to: "/mes-listes" }}
          items={resume}
          hideWhenEmpty
        />
      )}

      {becauseYouLike.length > 0 && anchorGenre && (
        <MediaCarousel
          title={`Parce que vous aimez ${anchorGenre}`}
          subtitle="Dans un genre que vous suivez souvent"
          items={becauseYouLike}
          hideWhenEmpty
          onHideItem={onHideItem}
        />
      )}

      {becauseYouLike2.length > 0 && anchorGenre2 && (
        <MediaCarousel
          title={`Parce que vous aimez ${anchorGenre2}`}
          items={becauseYouLike2}
          hideWhenEmpty
          onHideItem={onHideItem}
        />
      )}

      {freshForYou.length > 0 && (
        <MediaCarousel
          title="Nouveautés qui pourraient vous plaire"
          subtitle="Sorties récentes et à venir en phase avec vos goûts"
          action={{ label: "À venir", to: "/a-venir" }}
          items={freshForYou}
          hideWhenEmpty
          onHideItem={onHideItem}
        />
      )}

      {discovery.length > 0 && (
        <MediaCarousel
          title="À découvrir pour vous"
          subtitle="Des pépites moins évidentes, choisies selon vos affinités"
          items={discovery}
          hideWhenEmpty
          onHideItem={onHideItem}
        />
      )}

      {canHide && hiddenEntries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/40 p-4">
          <p className="text-sm text-muted-foreground">
            {hiddenEntries.length} titre{hiddenEntries.length > 1 ? "s" : ""} masqué
            {hiddenEntries.length > 1 ? "s" : ""} de vos recommandations.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => hiddenEntries.forEach((f) => restore(f.mediaKey))}
          >
            <Undo2 className="h-4 w-4" /> Tout réafficher
          </Button>
        </div>
      )}


      <div className="card-elevated flex flex-col items-start gap-3 rounded-2xl border border-primary/20 bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Une envie précise&nbsp;?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Demandez à l'assistant : « un anime horreur », « film récent bien noté »…
          </p>
        </div>
        <RecommendationAssistant />
      </div>
    </div>
  );
}
