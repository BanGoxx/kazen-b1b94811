# KAZEN — Roadmap

## Vision
App anime / séries / films : claire, premium, utile au quotidien, riche, rapide, agréable.
Règle produit : chaque fiche doit être améliorée au maximum (inspiration Nautiljon, mais plus propre / moderne / premium / lisible).

## Déjà fait
- Accueil : hero rotatif, mise en avant anime, sections découverte cohérentes
- Catalogue : séparation anime/séries, scroll infini renforcé
- Calendrier : semaine actuelle + suivante, semaine courante mise en avant
- Fiches : métadonnées enrichies (titres alt, source, âge, pays, date fin, vidéos), synopsis lire plus/moins, sections homogènes
- Relations : regroupement franchise / œuvres liées / recommandations
- Utilité fiche : badge suivi, prochain épisode + compte à rebours, où regarder, genres cliquables
- Plateformes : mapping providers, tolérance variantes TMDB, redirections officielles
- Espace membre : RLS accepte anilist / tmdb_movie / tmdb_tv

## À revérifier en priorité
- ajout liste, statuts, note étoiles, tags perso, notes perso, affichage Mes listes
- cohérence preview vs live, providers visibles en live, redirections réelles, images manquantes

## Ordre conseillé
1. Fiabiliser totalement l'espace membre ✅
2. Valider plateformes + redirections sur le live ✅
3. Corriger images manquantes ✅
4. Finir scroll infini sur la recherche ✅
5. Fiches enrichies (en cours) + pages Groupe / Franchise ✅ (nouvelle brique)
6. Améliorer calendrier + filtres avancés (année, format, catégorie, chronologique, ordre sortie)
7. Import/export MAL (puis AniList)
8. Ajouter catégorie Donghua
9. Communauté (forum, rangs, listes partagées, profils) — long terme

## Pages Groupe / Franchise (fait)
- Clé de groupe dérivée via `deriveGroupAnchor` (ancre sur l'« Œuvre parente » si présente, sinon l'œuvre elle-même) — clé stable partagée par tout l'univers.
- Route `/franchise/$source/$id` construite sur `buildFranchiseGroup` (réutilise la logique `franchise.ts`, ne duplique rien).
- Agrégation multi-formats : Animes, Manga, Light novel / Roman, Musique / OST, Autres (données AniList : nœuds ANIME + MANGA/NOVEL/MUSIC, année incluse).
- Tri par année puis titre ; filtres par type et par époque (décennie).
- Sections vides omises ; page affichée seulement si l'univers a ≥ 2 œuvres.
- Lien « Groupe / Franchise » sur la fiche uniquement quand des liens franchise/adaptation existent (sinon fiche propre, inchangée).
- Cartes non-anime (manga/LN/OST) non cliquables (pas de fiche dédiée) pour éviter les liens cassés.

## Rappel
KAZEN doit aider à découvrir, suivre, retrouver, explorer un univers complet, et rendre chaque fiche vraiment utile.
