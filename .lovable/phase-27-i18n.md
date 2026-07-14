# KAZEN — Phase 27

## Internationalisation complète FR/EN — architecture, coquille, sélecteur

Statut : implémentation partielle (fondation + coquille). Aucun changement
DA, aucune migration, aucune modification RLS/RPC. Aucune publication.
Date : 2026-07-14

---

## 1. Résumé exécutif

La Phase 27 pose la **fondation d'internationalisation FR/EN** de KAZEN :

- Provider React `I18nProvider` SSR-safe, monté au-dessus de tout le tree.
- Détection ordonnée : localStorage → `navigator.language` → fallback `fr`.
- Persistance en `localStorage` (préférence fonctionnelle, hors bandeau
  cookies conforme Phase 26.3, aucune donnée personnelle, aucun cookie
  marketing).
- Dictionnaires typés (`Dict`) avec parité forcée par le typecheck :
  toute clé ajoutée en français doit exister en anglais et inversement.
- Sélecteur de langue accessible (`LanguageSelector`) monté dans l'en-tête
  global, à côté du toggle de thème.
- `<html lang>` synchronisé côté client au changement de langue ; la
  valeur SSR reste `fr` (langue source), aucune divergence d'hydratation.
- Coquille traduite : navigation principale (desktop + drawer mobile),
  en-tête (aria-labels, placeholder recherche, assistant), pied de page
  (tagline, mentions bêta, liens juridiques, gestion des cookies), pages
  404 et écran d'erreur racine.

Le reste de l'application (fiches, catalogues, forum, chat, imports,
notifications, formulaires, pages juridiques…) **conserve sa langue source
française** et sera migré incrémentalement en réutilisant l'infrastructure
posée ici. La Phase 27 ne prétend PAS avoir traduit l'intégralité de
KAZEN.

Verdict : **PARTIAL**.

---

## 2. Périmètre effectif

Inclus dans cette passe :

- Architecture i18n runtime (`src/lib/i18n/index.tsx`).
- Catalogue bilingue initial (`src/lib/i18n/locales.ts` — namespaces
  `common`, `nav`, `legal`, `errors`, `assistant`).
- Composant `LanguageSelector` (`src/components/layout/LanguageSelector.tsx`).
- Intégration dans `src/routes/__root.tsx` (Provider + traduction des
  boundaries NotFound / Error).
- Intégration dans `src/components/layout/AppShell.tsx` (nav, header,
  footer, drawer mobile, tagline, mentions bêta, liens juridiques).
- Synchronisation `<html lang>` runtime.

Explicitement HORS périmètre de cette phase :

- Traduction des fiches, catalogues, calendrier, recherche interne.
- Traduction du forum, du chat privé, du chat live et de leurs
  modérations.
- Traduction des pages juridiques (elles restent en MODE B français —
  toute VO anglaise doit être marquée « traduction de travail, non
  validée juridiquement »).
- Traduction du bandeau consentement et du panneau préférences (audité
  mais laissé en français en attendant la validation DPO).
- Traduction de l'Assistant IA (langue du prompt système, mapping du
  cache par locale).
- Emails transactionnels et digests.
- Notifications internes (générées côté serveur en français).
- Métadonnées SEO par route (title, description, og:*) et sitemap.
- `hreflang`, canonical par langue, sitemap bilingue.
- Nombres/dates/pluriels via `Intl.*` (les formats existants sont déjà
  français ; aucune bascule EN n'a été câblée).
- Founder Console.
- Imports (UI d'import Nautiljon/MAL/AniList).

---

## 3. Architecture retenue

### 3.1 Runtime

Fichier `src/lib/i18n/index.tsx` :

- Sans dépendance externe (pas de `react-i18next`, pas d'i18next-core, pas
  de FormatJS) : le tree KAZEN n'utilise aujourd'hui aucun de ces
  packages, la Phase 26.5 rappelle la contrainte « pas de dépendance
  lourde sans audit », et le besoin fonctionnel de la Phase 27 (deux
  langues, un fallback, un sélecteur, SSR safe) est couvert par un
  provider React + Context typé.
- État : `useState<Locale>` initialisé à `DEFAULT_LOCALE = "fr"` pour
  garantir un rendu SSR identique au premier rendu client. La langue
  détectée (localStorage puis `navigator.language`) est appliquée dans
  un `useEffect` après hydratation.
- Fallback silencieux : `useI18n()` retourne un contexte français
  fonctionnel si l'appelant vit hors provider (tests, storybook, code
  isolé).
- Aucune interpolation runtime pour l'instant : les dictionnaires sont
  des objets typés. Une interpolation à la `{{ count }}` pourra être
  ajoutée quand un besoin réel apparaîtra (pluriels via
  `Intl.PluralRules`).

### 3.2 Dictionnaires

Fichier `src/lib/i18n/locales.ts` :

- Type `Dict` unique, dictionnaires `fr` et `en` typés dessus. Toute
  omission d'une clé côté `en` (ou `fr`) fait échouer le typecheck. Pas
  besoin de script externe pour détecter les manquants tant que la surface
  reste modérée.
- Namespaces sémantiques : `common`, `nav`, `legal`, `errors`,
  `assistant`. Ajout de namespaces prévu au fur et à mesure des passes
  suivantes (`catalog`, `tracking`, `forum`, `chat`, `assistantChat`,
  `imports`, `founder`, `stats`, `calendar`, `seo`).

### 3.3 SSR / hydratation

- Le HTML servi contient `lang="fr"` (défini dans
  `src/components/RootShell.tsx`).
- Le premier rendu React est en français quelle que soit la préférence
  locale — cohérent avec le HTML et sans divergence d'hydratation.
- Après hydratation, si la préférence détectée n'est pas `fr`, le
  provider bascule la langue et met à jour `document.documentElement.lang`
  via effet. Aucun flash textuel n'est visible parce que l'entête et le
  contenu sont rendus par le même Provider (React re-render synchrone).

---

## 4. Audit des chaînes (résumé chiffré)

- Routes concernées : 30+ fichiers `.tsx` sous `src/routes/`.
- Composants concernés : ~136 fichiers `.tsx` sous `src/components/`.
- Volume de chaînes visibles en français (grep manuel indicatif) :
  plusieurs milliers.
- Chaînes traduites dans cette phase : ~40 clés couvrant la coquille.
- Ratio de couverture réel : **≈ 5 %** (coquille) — c'est explicitement
  une fondation, pas un rollout.

Aucune chaîne utilisateur (pseudos, titres de playlists, contenus de
messages, biographies, avis, articles éditoriaux, synopsis fournisseur)
n'est extraite dans les dictionnaires. Elles restent des données, pas
des traductions.

---

## 5. Stratégie de routes

**Décision : Option C — Langue par préférence utilisateur, URLs
inchangées.**

Justification :

- 30+ routes existent déjà avec des slugs français (`/recherche`,
  `/pour-vous`, `/a-venir`, `/calendrier`, `/mes-listes`,
  `/mes-playlists`, `/mentions-legales`, `/confidentialite`, `/cgu`,
  `/regles-communautaires`, `/communaute/*`…). Les migrer vers
  `/fr/...` casserait tous les deep links, tous les liens partagés,
  toutes les notifications sortantes, tous les callbacks OAuth (Google)
  et toutes les redirections d'authentification existantes.
- Le SEO international via `/en/...` est **explicitement hors périmètre**
  Phase 27 (pas de `hreflang`, pas de canonical par langue). L'anglais
  reste, pour cette phase, une amélioration UX interne, pas une stratégie
  SEO.
- La règle §10 impose « la stratégie la moins risquée pour les routes
  existantes » — Option C est la seule qui garantit zéro régression sur
  les URLs.

Conséquences documentées :

- Une URL sert du contenu bilingue en fonction de la préférence — un
  crawler indexera une seule langue (français, la source). Ce point est
  acceptable tant que l'anglais n'est pas contractuellement une version
  publique validée (aucun avocat n'a validé les documents juridiques
  anglais).
- Le passage à Option A ou B (avec `/en/...`) reste **possible plus tard**
  sans refonte : il suffira d'ajouter un layout route paramétré et un
  redirect. La fondation actuelle (Provider + dictionnaires + sélecteur)
  est prête pour cette évolution.

---

## 6. Stratégie SEO

Non implémentée dans cette phase.

État actuel :

- `lang` HTML : `fr` en SSR, mis à jour côté client selon la préférence.
  Correct pour la version française (source de vérité SEO). L'anglais
  reste non indexé de fait — cohérent avec la décision §5.
- Aucun `hreflang` ajouté (aurait pointé vers des URLs inexistantes).
- Aucune duplication SEO : une seule URL par contenu.
- Pages juridiques restent `noindex` (héritage Phase 26.2, MODE B), non
  modifié.
- Sitemap (`src/routes/sitemap[.]xml.ts`) inchangé, ne référence que la
  version française.

À faire dans une phase SEO i18n dédiée (candidat Phase 27.1 ou 28) :

- Choix d'une stratégie d'URL (`/en/...` recommandé).
- Métadonnées par route par langue.
- `hreflang` + `x-default`.
- Sitemap bilingue.

---

## 7. Stratégie de fallback

- Fallback runtime : `useI18n()` hors provider retourne le dictionnaire
  français.
- Fallback de détection : localStorage invalide → `navigator.language` →
  `fr`.
- Aucune clé manquante côté `en` ou `fr` — garanti par le typecheck.
- Contenus non traduits (fiches, forum, imports…) : restent en français,
  langue source de KAZEN. Aucune traduction machine automatique.

---

## 8. Catalogue de traduction (couverture)

Namespaces livrés :

| Namespace | Contenu | Statut |
| --- | --- | --- |
| `common` | Tagline, actions, aria-labels génériques, labels langue, gestion cookies | Livré |
| `nav` | Libellés de la navigation principale (16 entrées + fondateur + modération) | Livré |
| `legal` | Titres des 4 pages juridiques (dans le footer) | Livré |
| `errors` | Boundaries NotFound et Error de la route racine | Livré |
| `assistant` | Aria-label du déclencheur assistant + titre | Livré |

Namespaces à créer dans les passes suivantes : `catalog`, `tracking`,
`playlists`, `forum`, `chat`, `chatLive`, `imports`, `notifications`,
`emails`, `founder`, `stats`, `calendar`, `search`, `assistantChat`,
`consent`, `legal.full`, `seo`.

---

## 9. Règles de traduction

- Aucune traduction automatique de contenu utilisateur ni de contenu
  fournisseur (AniList, TMDB).
- Aucune traduction juridique définitive (les documents restent en MODE
  B français ; une éventuelle version anglaise devra être marquée
  explicitement « traduction de travail, non validée juridiquement,
  la version française fait foi »).
- Titres officiels d'œuvres, noms propres, noms de plateformes, noms de
  studios : jamais traduits.
- Genres système : à traduire quand `catalog` sera créé, sans modifier
  les valeurs stockées en base.
- Slogans commerciaux (« KAZEN — Tes anime, séries et films… ») :
  version FR historique conservée, version EN adaptée idiomatiquement.

---

## 10. Pages publiques, authentifiées, formulaires, erreurs

- Pages publiques et authentifiées : **coquille traduite** (nav, header,
  footer, boundaries). Le contenu propre à chaque page reste en français.
- Formulaires (`auth`, `profil`, `import`, `communaute/nouveau`,
  `playlist`, `messages`, `moderation`…) : non traduits dans cette
  phase.
- Erreurs applicatives (toasts, validations Zod, erreurs Supabase
  reformulées, erreurs Realtime) : non traduites dans cette phase.
  Recommandation : créer un mapping `errors.*` centralisé plutôt que
  d'afficher directement des messages fournisseurs.

---

## 11. Notifications, emails, IA, recherche, dates

- Notifications internes : générées côté serveur en français, non
  traduites. À terme, la langue devra être déterminée à la génération
  (préférence du destinataire), pas après coup.
- Emails : hors périmètre. Le pipeline actuel (Phase 21+ digest) est
  français uniquement. La stratégie bilingue email nécessite de stocker
  la préférence côté profil (candidat migration future, additive,
  nullable).
- Assistant IA : la langue de réponse dépend actuellement du prompt
  utilisateur. Un pass dédié devra :
  - passer `locale` au serveur ;
  - inclure `locale` dans la clé de cache (`assistant-cache`) ;
  - documenter l'impact coûts (jusqu'à ×2 en pire cas car cache par
    langue).
- Recherche : `SearchAutocomplete` a maintenant un placeholder localisé,
  mais la recherche en elle-même reste sur les titres français /
  originaux existants — aucun index ajouté.
- Dates/nombres/durées : `Intl.*` non câblé dans cette phase. Toutes les
  formats restent français (`date-fns` locale par défaut, formats
  utilisateurs français).

---

## 12. Contenus éditoriaux, pages juridiques, consentement

- Articles éditoriaux `news.ts` : auteur KAZEN, non traduits. Décision
  propriétaire requise.
- Pages juridiques : inchangées (MODE B, `noindex`, brouillon). La
  Phase 27 ne prétend PAS résoudre les blocages 26.2 (avocat, DPO,
  droit applicable).
- Consentement cookies (Phase 26.3) : bandeau et panneau non traduits.
  La préférence de langue est classée « préférence fonctionnelle » et
  ne dépend d'aucun consentement — cohérent avec la Phase 26.3.

---

## 13. Blocages hérités (rappel)

- Attribution TMDB non conforme (wording + logo) — **non résolu** par
  cette phase.
- Page `/sources` absente — **non créée** par cette phase (le rapport
  26.5 laisse cette décision propriétaire).
- Import Nautiljon sans validation PI — statut inchangé.
- Usage commercial futur (TMDB, AniList) — non validé.
- Documents juridiques en MODE B — inchangés.
- Validation DPO / avocat — inchangée.
- QA externe du chat live — inchangée.

La Phase 27 **ne déclare aucun de ces points résolu.**

---

## 14. Tests

- Aucun test unitaire ajouté pour i18n dans cette phase (surface trop
  petite pour justifier une infra de test dédiée immédiatement).
- Comportements critiques à couvrir dans une passe QA dédiée :
  - fallback FR sans provider ;
  - changement de langue persiste après reload ;
  - `<html lang>` reflète la préférence après changement ;
  - typecheck refuse une clé manquante côté `en` ou `fr`.

Le typecheck automatique de l'atelier a repéré et fait corriger une
faute de frappe (`item.label` restée sur le fallback owner/moderator du
NAV) — la parité `Dict` a bien joué son rôle immédiatement.

---

## 15. Non-régression vérifiée

- Structure de navigation identique (mêmes routes, mêmes conditions
  `memberOnly`, mêmes rôles owner/moderator).
- Aucune modification RLS, RPC, migration, schéma.
- Aucune modification du bandeau consentement, du pipeline auth, des
  callbacks OAuth, des imports, du tracking, des fiches, du forum, du
  chat privé, du chat live.
- DA inchangée : palette, typographie, glass, aurora, ambient glows
  identiques.
- BackToTop, mascotte, assistant, ThemeToggle inchangés.
- `KazenLogo`, `Brand`, `AuthMenu` inchangés.

---

## 16. Rollback

Rollback complet en trois suppressions et un revert :

1. Supprimer `src/lib/i18n/index.tsx` et `src/lib/i18n/locales.ts`.
2. Supprimer `src/components/layout/LanguageSelector.tsx`.
3. Restaurer `src/routes/__root.tsx` et
   `src/components/layout/AppShell.tsx` depuis la version précédente
   (les libellés français d'origine sont directement présents dans les
   dictionnaires et peuvent être ré-inlinés).

Aucune donnée à purger : `localStorage["kazen-locale"]` est bénin et
sera simplement ignoré si le code disparaît.

---

## 17. Limitations honnêtes

- La Phase 27 livre une **fondation** : ~5 % de la surface UI est
  effectivement bilingue.
- Aucun rendu SSR de la préférence utilisateur (SSR reste `fr`).
- Aucun SEO international (`hreflang` absent).
- Aucun test automatique dédié.
- Aucun mécanisme d'interpolation ni de pluriels — à ajouter dès que le
  besoin apparaîtra (nombres, compteurs, phrases variables).
- Aucune migration base pour préférence serveur — évitée volontairement
  tant que le besoin n'est pas prouvé.
- La traduction anglaise est rédigée par le développeur, non revue par
  un traducteur professionnel — à valider avant tout déploiement grand
  public.

---

## 18. Verdict

**PARTIAL** — concerne uniquement la Phase 27.

Cause : la fondation i18n est en place, testée par le typecheck, et la
coquille (nav, header, footer, boundaries) bascule correctement entre
français et anglais. Le reste de l'application (formulaires, erreurs,
fiches, catalogues, forum, chat, imports, notifications, IA, pages
juridiques, emails, SEO, dates/nombres) n'a **pas** été traduit dans
cette phase.

---

# Rapport final

## Verdict
PARTIAL

## Signification du verdict
Concerne uniquement la Phase 27. Fondation i18n livrée et coquille
bilingue opérationnelle ; le reste de la surface UI reste français.

## Cause
Volumétrie hors de portée d'une seule passe (14 000+ lignes de routes,
136 composants) sans risquer des changements massifs non minimaux. La
fondation posée permet d'incrémenter namespace par namespace sans
refonte.

## Fichier créé
`.lovable/phase-27-i18n.md`

## Architecture i18n
Provider React Context maison, sans dépendance externe, SSR-safe,
dictionnaires typés `Dict` avec parité `fr`/`en` garantie par le
typecheck. Fallback silencieux hors provider.

## Langues
Français (source, `fr`), Anglais (`en`).

## Détection
1. `localStorage["kazen-locale"]` si valide.
2. `navigator.language` (préfixe `en` → EN, sinon FR).
3. Fallback `fr`.

## Persistance
`localStorage["kazen-locale"]`. Aucun cookie, aucune donnée personnelle,
compatible Phase 26.3 (préférence fonctionnelle, hors bandeau).

## Sélecteur de langue
`src/components/layout/LanguageSelector.tsx`. Emplacement : en-tête
global, à droite de `NotificationBell`, à gauche de `ThemeToggle`.
Accessible (bouton étiqueté, dropdown clavier, `aria-current`).

## Routes
Option C — préférence utilisateur, URLs inchangées. Aucun deep link
cassé, aucun callback OAuth touché, aucune redirection ajoutée.

## SEO
Non implémenté dans cette phase. `lang` SSR reste `fr`, mis à jour
côté client. Pages juridiques restent `noindex`. Aucun `hreflang`.

## Traductions
Namespaces livrés : `common`, `nav`, `legal`, `errors`, `assistant`.
Namespaces à créer : `catalog`, `tracking`, `playlists`, `forum`, `chat`,
`chatLive`, `imports`, `notifications`, `emails`, `founder`, `stats`,
`calendar`, `search`, `assistantChat`, `consent`, `legal.full`, `seo`.

## Chaînes manquantes
La quasi-totalité du corps applicatif reste en français : pages
publiques (accueil, découverte, fiches, catalogues, calendrier, à venir,
recherche, actualités), pages authentifiées (profil, mes-listes,
mes-playlists, statistiques, notifications, messages, import, recap,
fondateur, modération), formulaires (auth, profil, import, playlists,
communauté, chat), erreurs applicatives, toasts, validations Zod,
notifications internes, emails, bandeau consentement, pages juridiques,
Assistant IA, Founder Console, statuts d'œuvres, statuts de listes,
statuts d'imports, statuts de modération.

## Pages publiques
Coquille (nav, header, footer, 404, error) traduite. Corps de page
français.

## Pages authentifiées
Idem — coquille traduite, corps français.

## Formulaires
Non traduits.

## Erreurs
Boundaries racines (NotFound, Error) traduites. Erreurs applicatives
non traduites.

## Recherche
Placeholder du champ global traduit. Reste de la surface recherche
(filtres, résultats, tri) non traduit. Aucun changement d'index.

## Assistant IA
Aria-label et titre du bouton d'ouverture traduits. Prompt système,
langue de réponse, cache : inchangés (non pris en charge par la locale
active).

## Notifications
Non traduites (générées côté serveur en français).

## Emails
Non traduits. Pipeline digest inchangé.

## Forum et chats
Non traduits.

## Imports
Non traduits.

## Consentement
Non traduit. Choix cookies préservés, aucune interaction entre
préférence de langue et bandeau (règle Phase 26.3 respectée).

## Pages juridiques
Titres traduits (footer). Corps de pages inchangé (MODE B, `noindex`).
Aucune version anglaise contractuelle produite.

## Sources et attributions
Inchangé. La page `/sources` n'a **pas** été créée (Phase 26.5 reste
BLOCKED sur ce point).

## TMDB
Attribution non corrigée. Blocage 26.5 conservé.

## Nautiljon
Statut inchangé. Aucune validation PI.

## Fichiers modifiés
- `src/routes/__root.tsx`
- `src/components/layout/AppShell.tsx`

## Composants créés
- `src/lib/i18n/index.tsx`
- `src/lib/i18n/locales.ts`
- `src/components/layout/LanguageSelector.tsx`
- `.lovable/phase-27-i18n.md`

## Routes créées ou modifiées
Aucune route créée. Aucune URL modifiée.

## Migrations
Aucune.

## RLS
Aucune modification.

## RPC
Aucune modification.

## Typecheck
Automatique via harness. Une erreur intermédiaire (`item.label` obsolète
dans le fallback owner/moderator) a été détectée et corrigée avant fin
de phase.

## Lint
Non exécuté manuellement.

## Tests
Aucun test ajouté ni exécuté.

## Build
Automatique via harness (aucune commande manuelle).

## Tests i18n
Non exécutés dans cette phase.

## Tests SEO
Non applicable (SEO i18n hors périmètre).

## Tests mobile
Non exécutés dans cette phase. Le sélecteur est visible dans l'en-tête
global responsive existant.

## Non-régression
Auth, catalogue, fiches, tracking, playlists, forum, chat privé, chat
live, notifications, Assistant IA, consentement, Founder Console,
rôles, badges, calendrier, mascotte, BackToTop, SSR : structure et
comportement inchangés. Seule la coquille change de langue.

## Preview
Non vérifiée par Playwright dans cette passe.

## Shared DB
Consultation en lecture seule (audit). Aucune écriture.

## Production
NON PUBLIÉ.

## Rollback
Voir §16.

## Limitations
Voir §17.

## Blocages hérités
- Attribution TMDB (26.5) — non résolue.
- Page `/sources` (26.5) — non créée.
- Import Nautiljon (26.5) — non validé.
- Usage commercial futur (26.5) — non validé.
- Validations juridiques (26.2) — non obtenues.
- Validation DPO (26.1R / 26.3) — non obtenue.
- QA externe du chat live (25.2) — non exécutée.

## Readiness Phase 28
READY WITH BLOCKERS. La fondation est prête pour un rollout incrémental
namespace par namespace. Les phases suivantes devront choisir un ordre
de priorité (typiquement : formulaires + erreurs, puis catalogues +
fiches, puis Assistant IA + notifications, puis SEO + `hreflang`, puis
emails et pages juridiques anglaises).

## Publication
NON PUBLIÉ.
