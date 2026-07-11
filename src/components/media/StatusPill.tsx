import { Pill, type PillProps } from "@/components/ui/pill";
import {
  WATCH_STATUS_LABELS,
  type WatchStatus,
  type PriorityLevel,
} from "@/lib/media-types";

const STATUS_TONE: Record<WatchStatus, PillProps["tone"]> = {
  a_voir: "neutral",
  en_cours: "primary",
  termine: "success",
  en_pause: "warning",
  abandonne: "danger",
};

const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  basse: "Priorité basse",
  normale: "Priorité normale",
  haute: "Priorité haute",
};

const PRIORITY_TONE: Record<PriorityLevel, PillProps["tone"]> = {
  basse: "neutral",
  normale: "accent",
  haute: "danger",
};

export function StatusPill({ status }: { status: WatchStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{WATCH_STATUS_LABELS[status]}</Pill>;
}

export function PriorityPill({ level }: { level: PriorityLevel }) {
  return <Pill tone={PRIORITY_TONE[level]}>{PRIORITY_LABELS[level]}</Pill>;
}
