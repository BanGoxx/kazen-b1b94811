import { useEffect, useMemo, useState } from "react";
import { useCandidatePool, useTasteProfile } from "@/lib/use-recommendations";
import { rankForYouAnimeFirst } from "@/lib/recommend";
import { MediaCarousel } from "./MediaCarousel";
import { RecommendationAssistant } from "./RecommendationAssistant";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import type { MediaItem } from "@/lib/media-types";

/** Compact "Pour vous" rail for the homepage, linking to the full page. */
export function ForYouHomeBlock() {
  // This rail derives from auth + the user's list + personalized signals, which
  // only exist on the client. Rendering it during SSR / first hydration pass
  // produces a server/client mismatch, so we reveal it only after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { pool } = useCandidatePool();
  const profile = useTasteProfile();
  const items = useMemo<MediaItem[]>(
    () => rankForYouAnimeFirst(pool, profile, { limit: 18 }).map((s) => s.item),
    [pool, profile],
  );

  if (!mounted || !items.length) return null;


  return (
    <section className="animate-fade-in">
      <MediaCarousel
        title="Pour vous"
        subtitle={
          profile.signalCount === 0
            ? "Une sélection pour démarrer — elle s'adapte à vos goûts"
            : "Recommandations personnalisées selon vos goûts"
        }
        action={{ label: "Voir tout", to: "/pour-vous" }}
        items={items}
      />
      <div className="mt-3 flex">
        <RecommendationAssistant
          trigger={
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <Wand2 className="h-4 w-4 text-primary" />
              Demander à l'assistant
            </Button>
          }
        />
      </div>
    </section>
  );
}
