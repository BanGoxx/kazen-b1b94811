import { useMemo } from "react";
import { useCandidatePool, useTasteProfile } from "@/lib/use-recommendations";
import { rankForYou } from "@/lib/recommend";
import { MediaCarousel } from "./MediaCarousel";
import { RecommendationAssistant } from "./RecommendationAssistant";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import type { MediaItem } from "@/lib/media-types";

/** Compact "Pour vous" rail for the homepage, linking to the full page. */
export function ForYouHomeBlock() {
  const { pool } = useCandidatePool();
  const profile = useTasteProfile();
  const items = useMemo<MediaItem[]>(
    () => rankForYou(pool, profile, { limit: 18 }).map((s) => s.item),
    [pool, profile],
  );

  if (!items.length) return null;

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
