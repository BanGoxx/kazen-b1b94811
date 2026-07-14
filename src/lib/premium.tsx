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

// ---------------------------------------------------------------------------
// KAZEN Premium bêta — entitlement de présentation (Phase 24)
//
// ⚠️ AUCUN PAIEMENT. Pendant la bêta, chaque membre authentifié bénéficie
// gratuitement de l'accès « KAZEN Premium ». C'est un état de présentation,
// PAS un abonnement payant : aucune donnée de facturation, aucun renouvellement,
// aucune conversion automatique. L'autorité réelle (rôles, RLS, quotas IA,
// modération) reste 100% côté serveur — ce libellé ne débloque aucune
// permission de sécurité.
//
// FUTURE MIGRATION (non active) : si un modèle d'entitlement payant est un jour
// approuvé, ajouter une table additive `entitlements(user_id, tier, ...)` et
// remplacer `useBetaPremium` par une lecture serveur. Tant que ce n'est pas
// décidé, on garde cet état purement présentationnel (aucune table dédiée).
// ---------------------------------------------------------------------------

export type Entitlement =
  | "free"
  | "beta_premium"
  | "plus_active"
  | "plus_grace_period"
  | "plus_expired";

export interface BetaPremiumState {
  entitlement: Entitlement;
  /** Tout membre authentifié pendant la bêta. */
  isBetaPremium: boolean;
  ready: boolean;
}

/**
 * Entitlement de présentation. Pendant la bêta : tout membre connecté = `beta_premium`.
 * Ne confère AUCUN privilège serveur — purement cosmétique/communication.
 */
export function useBetaPremium(): BetaPremiumState {
  const { user, ready } = useAuth();
  const isBetaPremium = Boolean(user);
  return {
    entitlement: isBetaPremium ? "beta_premium" : "free",
    isBetaPremium,
    ready,
  };
}

export const BETA_PREMIUM_COPY = {
  badge: "Premium bêta",
  offered: "Accès Premium offert",
  primary: "Pendant la bêta, tu bénéficies gratuitement de l'accès KAZEN Premium.",
  secondary:
    "Certaines fonctionnalités avancées pourront rejoindre KAZEN Plus à l'avenir. Une version gratuite complète restera disponible.",
  betaNotice:
    "Pendant la bêta, les membres peuvent tester gratuitement l'ensemble des fonctionnalités actuellement disponibles.",
} as const;

/** Tarifs UNIQUEMENT indicatifs — aucun paiement actif, aucun checkout. */
export const FUTURE_PLUS_PRICING = {
  standard: "1,99 €",
  founding: "0,99 €",
  disclaimer: "Tarifs envisagés — aucun paiement n'est actuellement actif.",
  foundingNote:
    "À partir de 0,99 € envisagé pour les premiers soutiens. Offre non disponible pendant la bêta.",
} as const;

/** Base gratuite envisagée (indicatif). */
export const FREE_BASELINE: string[] = [
  "Catalogue et fiches détaillées",
  "Recherche",
  "Ma liste",
  "Suivi standard",
  "Favoris et notes",
  "Playlists standard",
  "Forum et messagerie privée",
  "Sécurité et confidentialité",
  "Blocage / signalement",
  "Calendrier standard",
  "Notifications standard",
  "Import / export essentiels",
  "Assistant IA (quota limité)",
];

/** Bénéfices futurs possibles de KAZEN Plus (hypothèses, non actifs). */
export const PLUS_FUTURE: string[] = [
  "Quota IA plus élevé",
  "Statistiques personnelles avancées",
  "Récap annuel enrichi",
  "Calendrier personnel avancé",
  "Personnalisation du profil",
  "Badge Premium / soutien",
  "Exports avancés",
  "Limites collaboratives étendues",
  "Filtres enregistrés supplémentaires",
  "Recommandations avancées",
  "Accès anticipé à certaines fonctionnalités",
];
