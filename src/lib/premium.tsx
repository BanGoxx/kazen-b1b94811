import { useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import {
  SlidersHorizontal,
  BellRing,
  CalendarClock,
  CalendarSync,
  BarChart3,
  Palette,
  ArrowDownUp,
  BadgeCheck,
  FolderTree,
} from "lucide-react";

/**
 * KAZEN — Couche « Soutien / Premium »
 *
 * Cette couche est volontairement légère et non bloquante :
 * - Le cœur de l'expérience reste 100% gratuit.
 * - `usePremium()` expose l'état du soutien de l'utilisateur.
 *
 * ⚠️ PLACEHOLDER : l'activation réelle passera plus tard par une
 * intégration de paiement (Stripe / Paddle) + une table `subscriptions`.
 * Pour l'instant, l'état est simulé côté client (localStorage) afin de
 * permettre de prévisualiser et tester tous les hooks UI sans backend.
 */

export type PremiumTier = "free" | "supporter";

const STORAGE_KEY = "kazen:supporter:v1";

// ---------------------------------------------------------------------------
// Store minimal (même pattern que src/lib/auth.ts)
// ---------------------------------------------------------------------------

let active = false;
let ready = false;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    active = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    active = false;
  }
  ready = true;
}

function subscribe(l: () => void) {
  ensureStarted();
  listeners.add(l);
  return () => listeners.delete(l);
}

/** PLACEHOLDER — bascule locale de démonstration. À remplacer par un vrai flux d'abonnement. */
export function setSupporterPreview(next: boolean) {
  active = next;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

export interface PremiumState {
  tier: PremiumTier;
  isSupporter: boolean;
  ready: boolean;
}

const SERVER_SNAPSHOT: PremiumState = { tier: "free", isSupporter: false, ready: false };

export function usePremium(): PremiumState {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (active ? SUPPORTER_STATE : FREE_STATE),
    () => SERVER_SNAPSHOT,
  );
  return snapshot;
}

const FREE_STATE: PremiumState = { tier: "free", isSupporter: false, ready: true };
const SUPPORTER_STATE: PremiumState = { tier: "supporter", isSupporter: true, ready: true };

// ---------------------------------------------------------------------------
// Modèle produit : positionnement + comparatif
// ---------------------------------------------------------------------------

export const SUPPORTER_PRICE = {
  monthly: "3,99 €",
  yearly: "34,99 €",
  currency: "EUR",
} as const;

export const SUPPORTER_PITCH = {
  title: "KAZEN Soutien",
  tagline: "Soutiens KAZEN, débloque des outils avancés.",
  description:
    "KAZEN restera toujours gratuit pour l'essentiel. Le soutien finance le développement et t'offre des outils premium pour organiser et suivre tes anime, séries et films encore plus finement.",
} as const;

export interface PremiumFeature {
  id: string;
  icon: typeof SlidersHorizontal;
  label: string;
  description: string;
  free: boolean | string;
  supporter: boolean | string;
  /** PLACEHOLDER = pas encore implémenté, UI seulement. */
  status: "ready" | "placeholder";
}

export const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    id: "filters",
    icon: SlidersHorizontal,
    label: "Filtres avancés",
    description: "Combine genres, plateformes, statuts et tags en filtres croisés.",
    free: "Filtres rapides",
    supporter: "Filtres croisés illimités",
    status: "placeholder",
  },
  {
    id: "alerts",
    icon: BellRing,
    label: "Alertes personnalisées",
    description: "Sois prévenu dès qu'un titre suivi bouge.",
    free: false,
    supporter: true,
    status: "placeholder",
  },
  {
    id: "reminders",
    icon: CalendarClock,
    label: "Rappels de sorties",
    description: "Un rappel avant chaque nouvel épisode ou sortie.",
    free: false,
    supporter: true,
    status: "placeholder",
  },
  {
    id: "calendar-sync",
    icon: CalendarSync,
    label: "Sync calendrier",
    description: "Exporte tes sorties vers Google Agenda / iCal.",
    free: false,
    supporter: true,
    status: "placeholder",
  },
  {
    id: "stats",
    icon: BarChart3,
    label: "Statistiques détaillées",
    description: "Temps de visionnage, répartition par genre et tendances.",
    free: "Compteurs de base",
    supporter: "Stats complètes",
    status: "placeholder",
  },
  {
    id: "themes",
    icon: Palette,
    label: "Thèmes personnalisés",
    description: "Accents et ambiances exclusives pour ton interface.",
    free: "Clair / Sombre",
    supporter: "Thèmes exclusifs",
    status: "placeholder",
  },
  {
    id: "sorting",
    icon: ArrowDownUp,
    label: "Organisation avancée",
    description: "Tri multi-critères et collections personnalisées.",
    free: "Tri simple",
    supporter: "Collections & tri avancé",
    status: "placeholder",
  },
  {
    id: "import-export",
    icon: FolderTree,
    label: "Import / Export",
    description: "Sauvegarde et migre tes listes en un clic.",
    free: false,
    supporter: true,
    status: "placeholder",
  },
  {
    id: "badge",
    icon: BadgeCheck,
    label: "Badge Soutien",
    description: "Un badge premium discret sur ton profil.",
    free: false,
    supporter: true,
    status: "ready",
  },
];
