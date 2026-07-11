# KAZEN — Passe « Roadmap + Optimisation des fiches »

Règle produit permanente (rappel) : chaque fiche doit viser la richesse d'un Nautiljon, mais plus propre, plus premium, mieux organisée, moins surchargée. Cette passe organise le travail par ordre de priorité plutôt que de tout empiler d'un coup.

## État actuel de la fiche
La fiche (`media.$source.$id.tsx`) affiche déjà : backdrop cinématique, poster, plateformes, panneau membre, type/score/studios, genres, trailer, grille de « facts », synopsis, saga (collection), casting, équipe, « À découvrir aussi ». Bonne base — le manque est surtout la **profondeur des données**, le **contenu interconnecté** et la **logique de franchise**.

## Ordre de la roadmap (du plus fort impact au plus fin)

### Étape 1 — Qualité & fiabilité des métadonnées (fondation)
Avant d'ajouter des blocs, fiabiliser ce qui existe.
- Compléter `MediaDetail` : `titleAlternatives` (titres alt/romaji/EN), `ageRating` (classification), `source` d'origine (manga/LN/roman/original), `countryOfOrigin`, `endDate`.
- Fallback FR renforcé pour synopsis/genres déjà en place — l'étendre aux nouveaux champs.
- Normalisation des studios/genres (dédup, casse, mapping FR cohérent).

### Étape 2 — Profondeur de la fiche (blocs structurés, dépliables)
Ajouter la richesse **sans surcharger** : sections claires, repliables sur mobile.
- Bloc « Informations » enrichi : titres alternatifs, classification d'âge, source, pays, dates début/fin, saison de diffusion.
- Synopsis avec « Lire plus / Lire moins » (clamp) pour garder la page aérée.
- Casting : rôles/personnages quand dispo (AniList characters + voice actors), pas seulement noms.
- Bloc « Bandes-annonces & vidéos » (plusieurs vidéos TMDB, pas un seul trailer).

### Étape 3 — Contenu lié & logique de franchise
Le plus « Nautiljon » : interconnexion.
- Regrouper `related` par type de relation (Suite, Préquelle, Adaptation, Spin-off, Même univers) au lieu d'une liste plate.
- Logique franchise : pour une collection/saga (films) ou une série d'anime, afficher un rail « Franchise » ordonné chronologiquement.
- Liens studios/genres cliquables → vers catalogue filtré (découverte interconnectée).

### Étape 4 — Suivi & utilité (fiche actionnable)
- Bloc « Où regarder » plus riche (plateformes + type d'offre quand dispo).
- Pour les séries/anime en cours : prochain épisode + compteur (déjà `nextEpisode` dans le type, l'exposer sur la fiche).
- Renforcer le lien fiche ↔ espace membre (statut/rating visibles inline).

### Étape 5 — Polish UX premium & performance
- Composant réutilisable `FicheSection` (titre + contenu + repli) pour homogénéiser toutes les sections.
- Lazy-load des blocs secondaires (casting/vidéos/related) sous le pli.
- Vérif contraste/lisibilité + skeletons cohérents.

## Détails techniques
- Étendre `MediaDetail` dans `src/lib/media-types.ts` et le mapping dans `getMediaDetail` (`discover.functions.ts`) + `normalize.ts` (AniList & TMDB).
- Nouveaux composants : `FicheSection.tsx`, `FranchiseRail.tsx`, `VideoGallery.tsx`, regroupement dans `RelatedScroller`.
- Aucun changement de palette ni d'architecture routes. Perf : garder les protections (cache AniList, caps de chargement), lazy-load pour compenser les blocs ajoutés.

## Proposition de démarrage
Commencer par **Étape 1 + Étape 2** dans la première passe (fondation métadonnées + profondeur visible immédiatement), puis Étapes 3–5 dans des passes suivantes. Dis-moi si tu valides cet ordre ou si tu veux prioriser la logique de franchise (Étape 3) en premier.
