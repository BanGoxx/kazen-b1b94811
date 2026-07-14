/**
 * KAZEN — Phase 27 i18n dictionaries.
 *
 * Bilingual FR/EN foundation. French remains the source of truth (product
 * language). English is a *working translation* — legal documents in
 * particular stay tied to the French MODE B drafts and must not be
 * presented as validated versions.
 *
 * Adding a namespace? Keep parity between `fr` and `en`, and prefer stable
 * semantic keys over full sentences as identifiers.
 */

export type Locale = "fr" | "en";
export const LOCALES: readonly Locale[] = ["fr", "en"] as const;
export const DEFAULT_LOCALE: Locale = "fr";

export type Dict = {
  common: {
    appTagline: string;
    dataSource: string;
    beta: string;
    betaNotice: string;
    premiumBetaNotice: string;
    learnMore: string;
    retry: string;
    backHome: string;
    loading: string;
    close: string;
    signIn: string;
    signOut: string;
    accountMenu: string;
    openMenu: string;
    closeMenu: string;
    search: string;
    searchPlaceholder: string;
    languageLabel: string;
    languageFrench: string;
    languageEnglish: string;
    drafts: string;
    manageCookies: string;
  };
  nav: {
    section: string;
    discover: string;
    search: string;
    forYou: string;
    anime: string;
    series: string;
    movies: string;
    animeSeason: string;
    upcoming: string;
    calendar: string;
    myList: string;
    stats: string;
    sharedPlaylists: string;
    community: string;
    liveChat: string;
    myPlaylists: string;
    import: string;
    support: string;
    founder: string;
    moderation: string;
  };
  legal: {
    legalNotice: string;
    tos: string;
    privacy: string;
    communityRules: string;
  };
  errors: {
    pageNotFoundTitle: string;
    pageNotFoundBody: string;
    genericTitle: string;
    genericBody: string;
  };
  assistant: {
    openLabel: string;
    title: string;
  };
};

const fr: Dict = {
  common: {
    appTagline: "Tes anime, séries et films. Enfin au même endroit.",
    dataSource: "Données : AniList & TMDB.",
    beta: "Bêta",
    betaNotice:
      "KAZEN est actuellement en bêta. Certaines fonctionnalités peuvent évoluer.",
    premiumBetaNotice:
      "Pendant la bêta, l'accès KAZEN Premium est offert à tous les membres.",
    learnMore: "En savoir plus",
    retry: "Réessayer",
    backHome: "Retour à l'accueil",
    loading: "Chargement…",
    close: "Fermer",
    signIn: "Se connecter",
    signOut: "Se déconnecter",
    accountMenu: "Menu du compte",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    search: "Recherche",
    searchPlaceholder: "Rechercher un anime, une série, un film…",
    languageLabel: "Langue",
    languageFrench: "Français",
    languageEnglish: "English",
    drafts: "Brouillons",
    manageCookies: "Gérer mes cookies",
  },
  nav: {
    section: "Navigation principale",
    discover: "Découverte",
    search: "Recherche",
    forYou: "Pour vous",
    anime: "Anime",
    series: "Séries",
    movies: "Films",
    animeSeason: "Saison anime",
    upcoming: "À venir",
    calendar: "Calendrier",
    myList: "Ma liste",
    stats: "Statistiques",
    sharedPlaylists: "Playlists partagées",
    community: "Communauté",
    liveChat: "Chat en direct",
    myPlaylists: "Mes playlists",
    import: "Importer",
    support: "Soutien",
    founder: "Espace fondateur",
    moderation: "Modération",
  },
  legal: {
    legalNotice: "Mentions légales",
    tos: "CGU",
    privacy: "Confidentialité",
    communityRules: "Règles communautaires",
  },
  errors: {
    pageNotFoundTitle: "Page introuvable",
    pageNotFoundBody:
      "La page que vous cherchez n'existe pas ou a été déplacée.",
    genericTitle: "Cette page n'a pas pu se charger",
    genericBody:
      "Une erreur est survenue de notre côté. Réessayez ou revenez à l'accueil.",
  },
  assistant: {
    openLabel: "Ouvrir l'assistant KAZEN",
    title: "Assistant",
  },
};

const en: Dict = {
  common: {
    appTagline: "Your anime, TV shows and movies. Finally in one place.",
    dataSource: "Data: AniList & TMDB.",
    beta: "Beta",
    betaNotice:
      "KAZEN is currently in beta. Some features may still evolve.",
    premiumBetaNotice:
      "During the beta, KAZEN Premium is free for every member.",
    learnMore: "Learn more",
    retry: "Try again",
    backHome: "Back to home",
    loading: "Loading…",
    close: "Close",
    signIn: "Sign in",
    signOut: "Sign out",
    accountMenu: "Account menu",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    search: "Search",
    searchPlaceholder: "Search for anime, TV shows or movies…",
    languageLabel: "Language",
    languageFrench: "Français",
    languageEnglish: "English",
    drafts: "Drafts",
    manageCookies: "Manage cookies",
  },
  nav: {
    section: "Main navigation",
    discover: "Discover",
    search: "Search",
    forYou: "For you",
    anime: "Anime",
    series: "TV shows",
    movies: "Movies",
    animeSeason: "Anime season",
    upcoming: "Upcoming",
    calendar: "Calendar",
    myList: "My list",
    stats: "Stats",
    sharedPlaylists: "Shared playlists",
    community: "Community",
    liveChat: "Live chat",
    myPlaylists: "My playlists",
    import: "Import",
    support: "Support us",
    founder: "Founder console",
    moderation: "Moderation",
  },
  legal: {
    legalNotice: "Legal notice",
    tos: "Terms",
    privacy: "Privacy",
    communityRules: "Community rules",
  },
  errors: {
    pageNotFoundTitle: "Page not found",
    pageNotFoundBody:
      "The page you're looking for doesn't exist or has been moved.",
    genericTitle: "This page couldn't load",
    genericBody:
      "Something went wrong on our side. Try again or go back home.",
  },
  assistant: {
    openLabel: "Open the KAZEN assistant",
    title: "Assistant",
  },
};

export const DICTIONARIES: Record<Locale, Dict> = { fr, en };
