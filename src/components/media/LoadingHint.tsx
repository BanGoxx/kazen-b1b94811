import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MediaGridSkeleton } from "./MediaGrid";
import { useI18n } from "@/lib/i18n";

// Progressive loading messaging: AniList hydration uses a browser-direct
// fallback with retries, so a plain skeleton can feel stuck. After a short
// delay we reassure the user, and after a longer delay we explain the retry /
// fallback path. This never blocks rendering — it only annotates the wait.
export type LoadPhase = "instant" | "loading" | "retrying";

export function useLoadPhase(active = true): LoadPhase {
  const [phase, setPhase] = useState<LoadPhase>("instant");
  useEffect(() => {
    if (!active) {
      setPhase("instant");
      return;
    }
    const t1 = setTimeout(() => setPhase("loading"), 2500);
    const t2 = setTimeout(() => setPhase("retrying"), 7000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active]);
  return phase;
}

export function useLoadPhaseLabel(
  phase: LoadPhase,
  label?: string,
): string | null {
  const { t } = useI18n();
  if (phase === "loading") return label ?? t.common.loadingContent;
  if (phase === "retrying") return t.common.loadingSource;
  return null;
}

// A small inline status line that materializes only after the wait feels long.
export function SlowLoadHint({
  active = true,
  label,
}: {
  active?: boolean;
  label?: string;
}) {
  const phase = useLoadPhase(active);
  const text = useLoadPhaseLabel(phase, label);
  if (!text) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-in fade-in"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </p>
  );
}

// A skeleton grid that grows a reassuring status line as the wait extends.
export function CatalogLoading({
  count = 10,
  label,
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div className="space-y-6">
      <SlowLoadHint label={label} />
      <MediaGridSkeleton count={count} />
    </div>
  );
}
