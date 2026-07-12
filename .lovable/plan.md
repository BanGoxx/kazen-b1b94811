# KAZEN — Roadmap

## Vision
App anime / séries / films : claire, premium, utile au quotidien, riche, rapide, agréable.
KAZEN doit aider à découvrir, suivre, retrouver et explorer un univers complet, et rendre chaque fiche vraiment utile.

## Règle permanente (ne jamais enfreindre)
**Améliorer KAZEN sans jamais casser ce qui fonctionne déjà.**
- Chaque évolution est une extension, pas une refonte.
- On garde intacts : fiches détail, espace membre, plateformes, calendrier, recherche, blocs franchise, palette « graphite & ember », protections de performance.
- Règle produit fiche : chaque fiche doit être améliorée au maximum (inspiration Nautiljon, mais plus propre / moderne / premium / lisible).
- Valider chaque étape sur le live (preview ≠ live).

---

## ✅ Déjà fait
- **Accueil / Découverte** : hero rotatif, mise en avant anime en premier, sections découverte cohérentes.
- **Catalogue** : séparation anime / séries propre, scroll infini renforcé (anime, séries, films).
- **Recherche** : scroll infini, dropdown de prévisualisation prédictif (titre, type, année, note, miniature), navigation clavier, debounce.
- **Calendrier** : semaine actuelle + semaine suivante, semaine courante mise en avant, bascule 1 sem. / 2 sem.
- **Fiches enrichies** : métadonnées (titres alt, source, âge, pays, date fin, vidéos), synopsis lire plus/moins, sections homogènes, genres/studios cliquables, badge suivi, prochain épisode + compte à rebours, où regarder.
- **Relations** : regroupement franchise / œuvres liées / recommandations.
- **Pages Groupe / Franchise** : route `/franchise/$source/$id`, clé stable via `deriveGroupAnchor`, agrégation multi-formats (Animes, Manga, LN/Roman, Musique/OST, Autres), tri par année + filtres type / époque, lien « Groupe » sur les fiches concernées uniquement.
- **Plateformes + images** : mapping providers tolérant, redirections officielles externes, fallbacks SVG pour posters/backdrops manquants.
- **Espace membre fiabilisé (live)** : auth, listes, statuts, note, favoris, tags, notes perso ; RLS accepte anilist / tmdb_movie / tmdb_tv.
- **Personnalisation** : moteur de reco hybride, page « Pour vous », rails personnalisés, assistant conversationnel (première version).
- **Supporter** : tiers, badge, page `/soutien`, déclencheurs discrets.
- **Identité** : marque KAZEN, logo, favicon, palette « graphite & ember », SEO (JSON-LD, h1, sitemap).

---

## 🔴 Priorité haute (prochaines étapes)

### 1. Espace membre / Mes listes / watchlist
- Continuer à fiabiliser et enrichir l'espace membre.
- Améliorer l'usabilité et la lisibilité de Mes listes / watchlist (tri, filtres, regroupement par statut, vues rapides).
- Augmenter la valeur perçue : progression, statistiques perso, accès rapide au prochain épisode.

### 2. Assistant chat (support en ligne visible)
- Transformer l'assistant en agent d'aide visible façon support en ligne.
- Bulle fixe en bas à droite de l'écran, toujours visible pendant le scroll.
- Sert à assister les membres : recherche, aide, questions.
- Élégant, non intrusif, cohérent avec la palette.

### 3. Recherche (suite)
- Continuer à améliorer l'expérience de recherche.
- Meilleure prévisualisation / visualisation dans les résultats.
- Renforcer la section recherche dédiée (UX, filtres, hiérarchie des résultats).

### 4. « À venir » (suite)
- Rendre la section encore plus utile et lisible.
- Mieux mettre en avant ce qui arrive bientôt (compte à rebours, tri chronologique, regroupement par date, « date à confirmer »).

---

## 🟠 Priorité moyenne

### 5. Calendrier (suite)
- Continuer à améliorer le calendrier : clair, utile, à jour, facile à lire.
- Garder une planification cohérente anime / séries / films.
- Filtres avancés : année, format, catégorie, ordre chronologique / ordre de sortie.

### 6. Découverte (suite)
- Vérifier si la page Découverte peut être encore améliorée.
- Meilleure utilité, clarté, hiérarchie des sections et personnalisation.

### 7. Animations / transitions / fluidité
- Rendre l'app plus fluide : transitions et micro-animations soignées.
- Élégant et moderne, jamais lourd ni distrayant.
- Ne pas casser `content-visibility` ni les protections de performance.

### 8. Direction visuelle / polish premium
- Moderniser encore l'identité, les couleurs et les animations.
- Rendre le site plus classe, fiable, premium et confortable.
- Améliorer la désirabilité sans perdre en lisibilité ni performance.

### 9. Continuer la montée en gamme des fiches
- Poursuivre l'enrichissement des fiches (règle permanente).

---

## 🟢 Long terme

### 10. Communauté / forum / espace social membre
- Améliorer l'espace membre communautaire.
- Ajouter des fonctionnalités de forum / communauté.
- Espaces de discussion entre membres, rangs, profils publics.

### 11. Avis communautaires / commentaires / partage de listes
- Sur chaque fiche :
  - avis / opinions des membres,
  - likes sur les commentaires,
  - réponses aux commentaires.
- Listes partagées :
  - likes,
  - tri par récence et popularité,
  - mise en avant des top playlists selon les likes.

### 12. Import / export & catalogue étendu
- Import/export MAL (puis AniList).
- Ajouter la catégorie Donghua.

---

## Notes techniques — Pages Groupe / Franchise (référence)
- Clé de groupe dérivée via `deriveGroupAnchor` (ancre sur l'« Œuvre parente » si présente, sinon l'œuvre elle-même) — clé stable partagée par tout l'univers.
- Route `/franchise/$source/$id` construite sur `buildFranchiseGroup` (réutilise `franchise.ts`, ne duplique rien).
- Agrégation multi-formats : Animes, Manga, Light novel / Roman, Musique / OST, Autres (nœuds AniList ANIME + MANGA/NOVEL/MUSIC, année incluse).
- Tri par année puis titre ; filtres par type et par époque (décennie).
- Sections vides omises ; page affichée seulement si l'univers a ≥ 2 œuvres.
- Lien « Groupe / Franchise » sur la fiche uniquement si des liens franchise/adaptation existent.
- Cartes non-anime (manga/LN/OST) non cliquables (pas de fiche dédiée) pour éviter les liens cassés.
