// KAZEN Internal Notification Center — Phase 1 (pure, UI-safe shared module).
// No browser/server-only imports here so it can be used from both sides.

export type NotificationType =
  | "new_episode"
  | "upcoming_release"
  | "related_article"
  | "personalized_recommendation"
  | "shared_list_request"
  | "shared_list_request_accepted"
  | "shared_list_request_declined"
  | "system_notice";

/** Preference categories exposed to members (one toggle each). */
export type NotificationCategory =
  | "new_episode"
  | "upcoming_release"
  | "related_article"
  | "recommendation"
  | "shared_list"
  | "system_notice";

export interface NotificationPreferences {
  new_episode_enabled: boolean;
  upcoming_release_enabled: boolean;
  related_article_enabled: boolean;
  recommendation_enabled: boolean;
  shared_list_enabled: boolean;
  system_notice_enabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  new_episode_enabled: true,
  upcoming_release_enabled: true,
  related_article_enabled: true,
  recommendation_enabled: true,
  shared_list_enabled: true,
  system_notice_enabled: true,
};

export interface AppNotification {
  id: string;
  type: NotificationType;
  eventKey: string;
  title: string;
  message: string;
  destinationUrl: string;
  mediaSource: string | null;
  mediaExternalId: string | null;
  articleSlug: string | null;
  occurredAt: string;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
}

/** Maps a notification type to the preference category that gates it. */
export const TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  new_episode: "new_episode",
  upcoming_release: "upcoming_release",
  related_article: "related_article",
  personalized_recommendation: "recommendation",
  shared_list_request: "shared_list",
  shared_list_request_accepted: "shared_list",
  shared_list_request_declined: "shared_list",
  system_notice: "system_notice",
};

export const CATEGORY_PREF_KEY: Record<
  NotificationCategory,
  keyof NotificationPreferences
> = {
  new_episode: "new_episode_enabled",
  upcoming_release: "upcoming_release_enabled",
  related_article: "related_article_enabled",
  recommendation: "recommendation_enabled",
  shared_list: "shared_list_enabled",
  system_notice: "system_notice_enabled",
};

export function isCategoryEnabled(
  prefs: NotificationPreferences,
  type: NotificationType,
): boolean {
  return prefs[CATEGORY_PREF_KEY[TYPE_TO_CATEGORY[type]]];
}

/** Category metadata for the preferences UI (French, KAZEN tone). */
export const NOTIFICATION_CATEGORY_META: Record<
  NotificationCategory,
  { label: string; description: string; icon: string }
> = {
  new_episode: {
    label: "Nouveaux épisodes",
    description: "Quand un nouvel épisode d'un titre suivi est disponible.",
    icon: "play",
  },
  upcoming_release: {
    label: "Sorties à venir",
    description: "Rappels des sorties proches des œuvres de votre liste.",
    icon: "calendar",
  },
  related_article: {
    label: "Articles liés",
    description: "Nos articles éditoriaux liés aux titres que vous suivez.",
    icon: "newspaper",
  },
  recommendation: {
    label: "Recommandations",
    description: "Suggestions personnalisées basées sur vos goûts.",
    icon: "sparkles",
  },
  shared_list: {
    label: "Listes partagées",
    description: "Activité autour des listes partagées.",
    icon: "users",
  },
  system_notice: {
    label: "Annonces KAZEN",
    description: "Informations importantes de l'équipe KAZEN.",
    icon: "megaphone",
  },
};

/** French relative time, calm and precise. */
export function relativeTimeFr(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = now.getTime() - then;
  const abs = Math.abs(diff);
  const min = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (abs < min) return "à l'instant";
  if (abs < hour) {
    const n = Math.round(abs / min);
    return diff >= 0 ? `il y a ${n} min` : `dans ${n} min`;
  }
  if (abs < day) {
    const n = Math.round(abs / hour);
    return diff >= 0 ? `il y a ${n} h` : `dans ${n} h`;
  }
  const n = Math.round(abs / day);
  if (n === 1) return diff >= 0 ? "hier" : "demain";
  if (n < 7) return diff >= 0 ? `il y a ${n} j` : `dans ${n} j`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function isUnread(n: AppNotification): boolean {
  return !n.readAt && !n.dismissedAt;
}
