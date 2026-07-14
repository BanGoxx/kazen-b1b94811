import { Pill, type PillProps } from "@/components/ui/pill";
import type { WatchStatus, PriorityLevel } from "@/lib/media-types";
import { useWatchStatusLabels, usePriorityLabels } from "@/lib/i18n/tracking";

const STATUS_TONE: Record<WatchStatus, PillProps["tone"]> = {
  a_voir: "neutral",
  en_cours: "primary",
  termine: "success",
  en_pause: "warning",
  abandonne: "danger",
};

const PRIORITY_TONE: Record<PriorityLevel, PillProps["tone"]> = {
  basse: "neutral",
  normale: "accent",
  haute: "danger",
};

export function StatusPill({ status }: { status: WatchStatus }) {
  const labels = useWatchStatusLabels();
  return <Pill tone={STATUS_TONE[status]}>{labels[status]}</Pill>;
}

export function PriorityPill({ level }: { level: PriorityLevel }) {
  const labels = usePriorityLabels();
  return <Pill tone={PRIORITY_TONE[level]}>{labels[level]}</Pill>;
}
