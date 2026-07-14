# KAZEN — Phase 26.5

## Licences, sources, images, articles et attributions

Statut : audit-only, aucun changement de code ni migration.
Date : 2026-07-14
Mode documents juridiques : MODE B (brouillons bloqués), inchangé depuis 26.2.

---

## 1. Résumé exécutif

La Phase 26.5 est un audit de provenance. Elle cartographie les sources
tierces réellement consommées par KAZEN, la nature des données, leur cache,
les attributions présentes et manquantes, et les usages incertains à faire
valider par un avocat / expert PI. Aucune modification n'a été appliquée :
les défauts constatés (attribution TMDB non conforme au wording exigé,
absence de page « Sources et crédits » centralisée, parser Nautiljon dont
l'autorisation de réutilisation n'est pas confirmée) sont documentés et
listés comme blocages propriétaire.

Verdict : **PARTIAL**.

---

## 2. Périmètre

Inclus : sources de métadonnées catalogue (AniList, TMDB), imports
utilisateurs (MyAnimeList XML, AniList par pseudo, Nautiljon HTML collé,
CSV/JSON KAZEN), vidéos YouTube (bandes-annonces), articles éditoriaux
internes, images distantes (s4.anilist.co, image.tmdb.org, i.ytimg.com),
plateformes de streaming (liens sortants), cache serveur mémoire, stockage
local navigateur.

Exclus : nouveaux fournisseurs non intégrés (Simkl, Anime-Planet,
Dailymotion, Vimeo — non utilisés), scraping automatisé (non pratiqué),
CDN interne (aucun proxy d'image côté KAZEN).

---

## 3. Méthodologie

- Lecture des documents 26.1R, 26.2, 26.3, 26.4 et audit 25.2→26.2.
- `rg` sur `anilist|tmdb|myanimelist|nautiljon|youtube|image.tmdb|img.youtube`.
- Inspection : `src/lib/anilist.server.ts`, `src/lib/anilist-public.ts`,
  `src/lib/tmdb.server.ts`, `src/lib/import/*`, `src/lib/news.ts`,
  `src/components/media/VideoGallery.tsx`, `src/components/media/TrailerDialog.tsx`,
  `src/components/layout/AppShell.tsx`, `src/routes/__root.tsx`,
  `src/routes/confidentialite.tsx`, `src/routes/mentions-legales.tsx`,
  `src/lib/platforms.ts`.
- Vérification de la version des documents légaux (MODE B, noindex).

---

## 4. Limites

- Aucune consultation juridique n'a été effectuée : toutes les mentions de
  conditions d'utilisation sont issues de la connaissance publique générale
  de ces API et NE constituent PAS une validation juridique.
- Impossible d'exécuter typecheck / build dans ce tour (audit-only).
- Impossible de tester rendu réel des pages sans preview interactif ici.
- Les conditions officielles d'AniList, TMDB, Nautiljon peuvent changer et
  ne sont pas versionnées dans le repo.

---

## 5. Inventaire des sources

| Source | Usage réel | Données utilisées | Accès | Cache | Attribution | Conditions connues | Risque |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AniList | Catalogue anime, fiches, relations, staff, personnages, recommandations | GraphQL public + fallback navigateur `anilist-public.ts` | Serveur (Worker) + client fallback | Mémoire L1 20 min, `anilist_cache` (Supabase) L2 | Footer « Données : AniList & TMDB » | GraphQL public, non commercial encouragé, attribution recommandée | Moyen — attribution minimale, usage commercial futur non couvert |
| TMDB | Films, séries, watch providers, images | REST v3 avec clé | Serveur uniquement (`tmdb.server.ts`) | Mémoire 20 min + stale-while-error | Footer « Données : AniList & TMDB » — **non conforme au wording exigé par TMDB** | « This product uses the TMDB API but is not endorsed or certified by TMDB. » + logo TMDB requis | Élevé — attribution obligatoire non conforme |
| YouTube | Bandes-annonces (embeds) | `videoId` uniquement, iframe `youtube-nocookie.com` après consentement | Client, click-to-load | Aucun côté KAZEN | Aucune (embed officiel) | Terms d'embed YouTube, cookies bloqués par 26.3 | Faible — consentement OK depuis 26.3 |
| `i.ytimg.com` | Thumbnails de bandes-annonces | Miniatures YouTube | Client, uniquement après consentement `externalMedia` | Cache navigateur | Idem YouTube | Idem embed | Faible |
| `s4.anilist.co` | Images (affiches, avatars) | Hotlink direct | Client via `<img>` | Cache navigateur/CDN AniList | Aucune spécifique à l'image | Hotlinking toléré par AniList, redistribution non explicite | Moyen |
| `image.tmdb.org` | Affiches, backdrops, logos | Hotlink direct | Client via `<img>` | Cache navigateur | Aucune spécifique à l'image | TMDB autorise l'usage des images pour applications utilisant l'API, avec attribution | Moyen |
| MyAnimeList (import utilisateur) | XML fourni par l'utilisateur | Titre, statut, score, dates, progression, tags, commentaires | Fichier local, parse client | Aucun — données converties en `list_items` du user | Aucune requise (données de l'utilisateur) | L'utilisateur exporte ses propres données MAL | Faible |
| AniList (import par pseudo) | Liste publique d'un utilisateur AniList | Mêmes champs de tracking | GraphQL public, appel client | Aucun cache d'import | À rappeler à l'utilisateur | Liste publique visible par tous ; requiert que l'utilisateur importe SA liste | Faible-Moyen |
| Nautiljon (import HTML) | Parsing de la page publique de la liste de l'utilisateur, collée dans l'UI | Titres, statut, progression, notes | Parse HTML client, **aucun scraping automatisé** | Aucun | Aucune (données de l'utilisateur) | Conditions Nautiljon strictes sur redistribution — usage utilisateur unique OK, republication interdite | **Élevé** — nécessite validation PI |
| CSV/JSON KAZEN | Ré-import de données exportées KAZEN | Champs de tracking KAZEN | Fichier local | N/A | N/A | Auto | Nul |
| Plateformes streaming | Liens sortants (Netflix, Crunchyroll, etc.) | Nom + logo interne (`platforms.ts`) | Liens statiques vers homepages officielles | Aucun | Marques citées, absence d'affiliation à préciser | Marques déposées de leurs titulaires | Faible-Moyen |
| Éditorial KAZEN (`news.ts`) | Articles internes | Auteur : KAZEN, ancrages sur `anilist:externalId` | Statique en repo | Aucun cache | Auteur KAZEN | Contenu original | Nul |

---

## 6. Matrice des données

| Champ | Source | Nature | Transformation | Stockage | Durée | Risque |
| --- | --- | --- | --- | --- | --- | --- |
| Titre, dates, épisodes, studios, genres, staff, casting | AniList / TMDB | Factuel | Aucun / normalisation | Cache mémoire + `anilist_cache` | 20 min L1, jours L2 | Bas (facts) mais base sui generis possible |
| Synopsis / description | AniList / TMDB | Texte potentiellement protégé | Affiché tel quel, tronqué visuellement | Cache mémoire uniquement | 20 min | Moyen — texte tiers republié |
| Affiche, banner, logo | AniList / TMDB | Image protégée | Hotlink sans transformation | Non stocké côté KAZEN | Cache navigateur uniquement | Moyen |
| Recommandations, relations | AniList | Structure éditoriale | Rendue telle quelle | Cache | 20 min | Bas-Moyen |
| Progression, notes utilisateurs, dates perso | Utilisateur | Personnel | Aucune | `list_items` (Supabase) | Permanent jusqu'à suppression | Nul (RGPD couvert par 26.1) |

---

## 7. Matrice des images

| Type | Source | Hébergement | Cache local | Transformation | Attribution | Usage commercial | Risque |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Affiches anime | s4.anilist.co | Hotlink AniList | Navigateur | Aucune | Footer global | Non couvert | Moyen |
| Affiches / backdrops films/séries | image.tmdb.org | Hotlink TMDB | Navigateur | Aucune | **Attribution TMDB non conforme** | Non couvert | Élevé |
| Logos plateformes | Interne (couleurs + nom) — pas de fichier logo importé | KAZEN | — | — | Marques citées | — | Faible |
| Thumbnails YouTube | i.ytimg.com | YouTube | Navigateur (après consentement) | Aucune | Embed officiel | OK dans le cadre embed | Faible |
| Avatars utilisateurs | Supabase Storage KAZEN | Interne | — | Upload utilisateur | N/A | N/A | Nul (utilisateur) |
| Couvertures de topics forum | Supabase Storage KAZEN | Interne | Signature serveur | Upload utilisateur | N/A | N/A | Nul |
| Images d'articles éditoriaux | Aucune image externe — `news.ts` n'embarque pas d'image tierce | — | — | — | — | — | Nul |

---

## 8. Matrice des vidéos

| Service | Où | Méthode | Consentement | Restrictions | Risque |
| --- | --- | --- | --- | --- | --- |
| YouTube | `VideoGallery.tsx`, `TrailerDialog.tsx` | Iframe `youtube-nocookie.com` après click-to-load, thumbnails bloqués avant consentement `externalMedia` (Phase 26.3) | Requis | Terms YouTube embed | Faible |
| Dailymotion / Vimeo / autres | Non utilisés | — | — | — | N/A |
| Fichiers vidéo hébergés | Aucun | — | — | — | N/A |

---

## 9. Matrice des articles

| Nature | Source | Auteur | Extraits | Image | Attribution |
| --- | --- | --- | --- | --- | --- |
| Articles internes `news.ts` | Rédaction KAZEN | Champ `source` par défaut = « KAZEN » | Contenu original | Aucune image tierce embarquée | Auto |
| Articles externes republiés | **Aucun** dans le catalogue actuel | — | — | — | — |

Aucun article externe n'est republié ; KAZEN ne fait pas d'agrégation
éditoriale tierce en Phase 26.5.

---

## 10. Imports utilisateurs

| Provider | Fichier | Traitement | Stockage temporaire | Rétention |
| --- | --- | --- | --- | --- |
| MAL XML | `series_title`, `series_animedb_id`, `my_*` | Parse client, jamais envoyé sur un serveur tiers | Mémoire du navigateur | Aucun stockage brut ; seules les entrées normalisées vont en base |
| AniList (username) | GraphQL public | Appel client, jusqu'à 5000 entrées | Mémoire du navigateur | Idem |
| Nautiljon HTML | HTML collé par l'utilisateur | Parse client | Mémoire du navigateur | Idem — mais **autorisation de traitement non validée** juridiquement |
| CSV / JSON KAZEN | Export propre | Parse client | Mémoire | Idem |

UX : la page `/import` mentionne déjà le caractère utilisateur-fourni.
Rappel supplémentaire à ajouter par le propriétaire : « Vous devez disposer
du droit d'utiliser le fichier importé. »

---

## 11. Cache et stockage

- `tmdbCache` : Map en mémoire, TTL 20 min, `staleUntil` pour tolérance
  panne. Aucun stockage durable.
- `anilistCache` : Map mémoire 20 min + table `anilist_cache` Supabase
  (L2). Contient réponses GraphQL brutes.
- `list_items` / `media_records` : données utilisateur permanentes (RLS OK).
- localStorage : préférences (consentement, thème, catalog state) — Phase 26.3
  clarifiée.
- Aucune image tierce n'est copiée dans Supabase Storage.

Point d'attention : le cache L2 AniList (`anilist_cache`) stocke
durablement des extraits (synopsis) qui sont des textes potentiellement
protégés. Durée à documenter et purger si demande d'ayant droit.

---

## 12. Attributions existantes

- Footer (`AppShell.tsx` ligne 326) : « Données : AniList & TMDB. »
- `confidentialite.tsx` §7 : mention AniList et TMDB comme sources publiques.
- `mentions-legales.tsx` : mention générique des tiers et procédure de
  retrait en préparation.

## 13. Attributions manquantes

- **TMDB** : phrase exacte requise (« This product uses the TMDB API but
  is not endorsed or certified by TMDB. ») et logo TMDB visible. Absent.
- **AniList** : lien vers `https://anilist.co` recommandé aux côtés de la
  mention. Absent (texte seul, non lié).
- **Page « Sources et crédits »** centralisée : absente.
- **Mention d'indépendance** vis-à-vis de Netflix / Crunchyroll / etc. :
  absente (nécessaire vu que les logos/couleurs des plateformes sont
  affichés dans les fiches).
- **Mention import Nautiljon** : rappel utilisateur (« Vous devez
  disposer du droit d'utiliser ce fichier ») à préciser.

---

## 14. Conditions d'utilisation connues

Résumé général (non validé juridiquement) :

- **AniList** — API GraphQL publique, sans clé, rate-limit ~90 req/min.
  Attribution recommandée. Redistribution commerciale non explicitement
  autorisée.
- **TMDB** — Clé API gratuite, attribution + logo TMDB obligatoires,
  restriction d'usage commercial (nécessite passage en compte Commercial).
- **YouTube** — Terms of Service pour les intégrations : consentement +
  respect des règles de branding.
- **MyAnimeList** — Import utilisateur de ses propres données : OK. Scraping
  de MAL non pratiqué.
- **Nautiljon** — Site français, conditions strictes contre le scraping et
  la republication. L'import HTML « fichier utilisateur collé » est en zone
  grise ; validation PI nécessaire avant lancement grand public.

---

## 15. Restrictions commerciales

- TMDB : usage commercial nécessite l'accord préalable et le compte
  Commercial. KAZEN Premium étant en beta gratuite (Phase 24), le
  déclenchement n'est pas encore critique — mais bloquant avant toute
  monétisation.
- AniList : usage commercial non explicitement autorisé.
- Nautiljon : usage commercial très probablement interdit.

## 16. Restrictions de redistribution

- Synopsis AniList/TMDB stockés dans le cache L2 : redistribution non
  explicite.
- Images hotlinkées : redistribution non applicable (pas de copie), mais
  affichage tiers à documenter.

---

## 17. Risques critiques

| ID | Description | Sévérité | Mitigation actuelle | Action requise |
| --- | --- | --- | --- | --- |
| S1 | Attribution TMDB non conforme (wording + logo) | Élevée | Mention texte partielle | Ajouter la phrase exacte + logo sur page Sources |
| S2 | Import Nautiljon non validé PI | Élevée | Aucun scraping automatisé, fichier fourni par l'utilisateur | Validation PI ou feature flag `founder-only` |
| S3 | Absence page « Sources et crédits » | Moyenne | Footer + confidentialité | Créer `/sources` (MODE B tant que non validé) |
| S4 | Absence mention d'indépendance plateformes streaming | Moyenne | Aucune | Ajouter mention sur page Sources |
| S5 | Cache L2 AniList contient synopsis tiers | Moyenne | TTL Supabase | Documenter durée + procédure de purge |
| S6 | Usage commercial futur (TMDB, AniList) | Élevée si monétisation | Beta gratuite | Bloquer avant Premium payant |

---

## 18. Mesures temporaires

Aucune mesure appliquée dans cette phase (audit-only). Mesures **proposées**
en attente de décision propriétaire :

- Feature flag `NAUTILJON_IMPORT_ENABLED = false` par défaut jusqu'à
  validation PI.
- `noindex` sur future page `/sources` tant que MODE B.
- Rappel utilisateur additionnel sur `/import`.

---

## 19. Corrections appliquées

**Aucune.** Phase audit-only.

---

## 20. Validations professionnelles requises

- **Avocat** : droit de citation (synopsis), responsabilité éditoriale,
  procédure de retrait, wording d'indépendance, wording d'attribution TMDB
  (formulation exacte à valider), formulation import utilisateur.
- **DPO** : hotlinking images (transmission IP utilisateur vers AniList,
  TMDB, YouTube), logs de cache, imports utilisateurs.
- **Expert PI** : AniList (redistribution synopsis + images), TMDB (usage
  commercial), Nautiljon (autorisation d'import HTML), stockage L2
  AniList, usage commercial futur.

---

## 21. Tests

Non exécutés (audit-only, pas de changement fonctionnel).

## 22. Non-régression

Non applicable — aucun code modifié.

## 23. Rollback

Non applicable — aucun changement.

## 24. Verdict

**PARTIAL** (concerne uniquement la Phase 26.5).

Cause : les attributions obligatoires (notamment TMDB) ne sont pas
conformes, la page « Sources et crédits » n'existe pas, l'import
Nautiljon reste sans validation PI, et plusieurs usages (usage commercial
futur, redistribution synopsis) restent à valider par un professionnel.
L'audit est complet et documenté ; les corrections nécessitent une
décision propriétaire.

---

# Rapport final

## Verdict
PARTIAL

## Signification du verdict
Concerne uniquement la Phase 26.5. La Phase 26.5 est **documentairement**
avancée mais **techniquement inachevée** : attributions obligatoires à
ajouter et validations professionnelles manquantes.

## Cause
Attribution TMDB non conforme, page Sources absente, import Nautiljon non
validé PI, usages commerciaux futurs à faire valider.

## Fichier créé
`.lovable/phase-26-5-licenses-sources-attributions.md`

## Sources identifiées
AniList, TMDB, YouTube (embed + thumbnails), MyAnimeList (import
utilisateur XML), AniList (import par pseudo), Nautiljon (import HTML
utilisateur), CSV/JSON KAZEN, plateformes streaming (Netflix, Prime,
Crunchyroll, ADN, Disney+, Canal+, Apple TV+, Max, Paramount+, OCS —
liens sortants), Supabase Storage (avatars, couvertures forum),
éditorial KAZEN interne (`news.ts`).

## AniList
Usage : catalogue anime, fiches, relations, staff, personnages,
recommandations, images. Attribution : footer texte seul, non liée.
Risques : redistribution synopsis, usage commercial futur.
Actions : lien vers anilist.co, page Sources, purge L2 sur demande.

## MyAnimeList
Usage : uniquement import XML fourni par l'utilisateur (`mal-parser.ts`).
Aucun scraping. Rétention : données transformées en `list_items` du user,
XML non stocké. Risques : faibles. Actions : rappel UX « vos données ».

## Nautiljon
Usage : `nautiljon-parser.ts` sur HTML collé par l'utilisateur. Aucun
scraping automatisé. Risques : conditions Nautiljon restrictives.
Mesures proposées : feature flag / limitation Founder tant que
validation PI absente. Statut : à faire valider avant lancement.

## TMDB
Usage : films, séries, watch providers, images. Attribution : **non
conforme** (wording et logo manquants). Risques : élevés (usage commercial
futur). Actions : ajouter phrase exacte + logo sur page Sources ;
bloquer monétisation avant compte Commercial.

## Autres sources
YouTube (embeds contrôlés par Phase 26.3), Supabase Storage (interne,
utilisateurs), éditorial KAZEN (`news.ts`, auteur interne).

## Métadonnées
Provenance : AniList (anime) + TMDB (films/séries). Cache : mémoire 20
min + L2 `anilist_cache`. Restrictions : redistribution synopsis à
documenter.

## Images
Provenance : s4.anilist.co, image.tmdb.org, i.ytimg.com, Supabase
Storage (interne). Hébergement : hotlink tiers. Cache : navigateur.
Attribution : partielle. Risques : moyens.

## Vidéos
YouTube uniquement, via `youtube-nocookie.com`, click-to-load conforme
26.3.

## Articles
`news.ts` : auteur KAZEN, aucune image tierce, aucun article externe
republié.

## Imports
MAL XML, AniList pseudo, Nautiljon HTML, CSV/JSON KAZEN. Tous
utilisateur-fournis, parsing client, pas de rétention brute.

## Attributions
Présentes : footer « Données : AniList & TMDB. ». Manquantes : wording
exact TMDB + logo, lien AniList, page Sources, mention d'indépendance
plateformes, rappel de droit utilisateur sur imports.

## Page Sources et crédits
Route : **absente**. Statut : à créer en MODE B avec `noindex`.
Contenu : sources métadonnées, attributions image, absence d'affiliation,
mentions imports.

## Absence d'affiliation
Non explicitée. À ajouter avant publication.

## Cache
TMDB 20 min mémoire ; AniList 20 min mémoire + L2 Supabase durable ; images
navigateur uniquement.

## Retrait
Procédure interne à documenter (réception → identification → mesure
conservatoire → analyse → retrait ou maintien → journalisation → réponse).
Capacité technique : présente (RLS + Founder Console).

## Mesures temporaires
Aucune appliquée. Proposées : feature flag Nautiljon, `noindex` page
Sources, rappel utilisateur import.

## Documents juridiques
Aucune modification. Restent en MODE B (26.2), `noindex` conservé.

## Fichiers modifiés
Aucun.

## Composants créés
Aucun.

## Routes
Aucune.

## Migrations
Aucune.

## RLS
Aucune modification.

## RPC
Aucune modification.

## Sécurité
Clé TMDB : côté serveur uniquement (`tmdb.server.ts`), jamais exposée
client. AniList : API publique sans clé. Aucune fuite détectée pendant
l'audit.

## Typecheck
Non exécuté (audit-only).

## Lint
Non exécuté (audit-only).

## Tests
Non exécutés.

## Build
Non exécuté.

## Tests fonctionnels
Aucun (audit-only).

## Non-régression
Non applicable — aucun changement.

## Preview
Non applicable.

## Shared DB
Consultation en lecture des schémas via inspection du code (pas de
modification).

## Production
Aucune publication automatique.

## Rollback
Aucun changement à annuler.

## Validation avocat
Wording attribution TMDB, droit de citation synopsis, responsabilité
éditoriale, procédure de retrait, wording indépendance plateformes,
rappel droit utilisateur pour imports.

## Validation DPO
Hotlinking (IP transmise à AniList / TMDB / YouTube), stockage L2
AniList, imports utilisateurs.

## Validation propriété intellectuelle
AniList, TMDB (usage commercial), Nautiljon (import HTML), redistribution
synopsis, usage commercial futur, attribution images.

## Décisions propriétaire
1. Activer ou non l'import Nautiljon avant validation PI.
2. Valider le wording exact et l'emplacement de l'attribution TMDB.
3. Décider de la création de la page `/sources` (MODE B).
4. Décider de la conservation ou purge du cache L2 AniList
   (`anilist_cache`).
5. Positionnement commercial futur (Premium payant → compte TMDB
   Commercial, licence AniList adaptée).
6. Wording d'indépendance des plateformes streaming.

## Limitations
- Aucune validation juridique effective.
- Typecheck / build non exécutés.
- Conditions des fournisseurs non versionnées dans le repo.
- Audit basé sur l'état du code au 2026-07-14.

## Readiness Phase 27
READY WITH BLOCKERS — la Phase 27 peut débuter techniquement, mais
plusieurs corrections (attribution TMDB, page Sources, statut import
Nautiljon) doivent être arbitrées en amont d'une publication grand
public.

## Publication
NON PUBLIÉ.
