/**
 * Localized tracking status labels. The DB enum values ("a_voir", "en_cours",
 * …) are technical identifiers and are never modified. This hook returns a
 * lookup table for display purposes only.
 */
import { useI18n } from "@/lib/i18n";
import type { WatchStatus, PriorityLevel, MediaStatus, MediaType } from "@/lib/media-types";

export function useWatchStatusLabels(): Record<WatchStatus, string> {
  const { t } = useI18n();
  return {
    a_voir: t.tracking.a_voir,
    en_cours: t.tracking.en_cours,
    termine: t.tracking.termine,
    en_pause: t.tracking.en_pause,
    abandonne: t.tracking.abandonne,
  };
}

export function usePriorityLabels(): Record<PriorityLevel, string> {
  const { t } = useI18n();
  return {
    basse: t.tracking.priorityLow,
    normale: t.tracking.priorityNormal,
    haute: t.tracking.priorityHigh,
  };
}

export function useMediaStatusLabels(): Record<MediaStatus, string> {
  const { t } = useI18n();
  return {
    a_venir: t.status.a_venir,
    en_cours: t.status.en_cours,
    termine: t.status.termine,
  };
}

export function useMediaTypeLabels(): Record<MediaType, string> {
  const { t } = useI18n();
  return {
    anime: t.mediaTypes.anime,
    series: t.mediaTypes.series,
    movie: t.mediaTypes.movie,
  };
}
