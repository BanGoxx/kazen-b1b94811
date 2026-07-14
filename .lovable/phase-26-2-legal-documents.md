# KAZEN — Phase 26.2 — Documents juridiques (brouillons)

> Document interne. Ne constitue pas un avis juridique.

## Verdict

**PARTIAL** — Phase 26.2 (mode B / brouillons bloqués).

## Signification du verdict

Le verdict concerne **uniquement la Phase 26.2** : la structure technique et rédactionnelle
des quatre documents juridiques fondamentaux est en place, mais leur finalisation dépend
d'informations propriétaire manquantes (C1, C2, C3, C6, C7) et de validations professionnelles
(avocat, DPO, expert PI) qui ne peuvent pas être obtenues dans cette phase.

## Cause

Les éléments obligatoires suivants restent inconnus :

- Identité juridique de l'éditeur (nom, statut, adresse, immatriculation, email de contact).
- Directeur de la publication.
- Entité contractuelle d'hébergement (adresse, contact).
- Contact LCEN de signalement de contenus illicites.
- Contact DPO ou responsable données personnelles.
- Âge minimum décidé pour l'accès au service.
- Droit applicable et juridiction (dépendent du siège de l'éditeur).
- Politique de licences des métadonnées et visuels tiers (AniList, TMDB).

En l'absence de ces éléments, les pages sont livrées comme **brouillons visibles** :
en-tête « Brouillon interne — non validé juridiquement », placeholders explicites
(`[À COMPLÉTER — décision propriétaire requise]`), `robots: noindex,nofollow` sur chaque
route, badge « Brouillons » dans le footer. Aucune fausse acceptation contractuelle n'est
collectée.

## Mode retenu

**MODE B** — brouillons bloqués. Les pages existent techniquement et sont accessibles
(indispensable pour la QA), mais elles ne sont pas présentées comme finalisées.

## Documents préparés

| Document | Route | Statut | Bloquants |
|---|---|---|---|
| Mentions légales | `/mentions-legales` | Brouillon | C1 éditeur, hébergeur contractuel, C6 LCEN, C3 PI |
| CGU | `/cgu` | Brouillon | C7 âge, droit applicable, juridiction, responsabilité (avocat) |
| Politique de confidentialité | `/confidentialite` | Brouillon | C2 responsable / DPO, bases légales, durées, DPA sous-traitants |
| Règles communautaires | `/regles-communautaires` | Brouillon lisible | Aucun bloquant strict — peut être finalisée après relecture avocat |

## Fichier créé

`.lovable/phase-26-2-legal-documents.md` (ce document).

## Fichiers modifiés

- `src/components/layout/AppShell.tsx` — ajout d'une barre de liens juridiques dans le footer, marquée « Brouillons ».

## Fichiers créés

- `src/lib/legal-config.ts` — variables juridiques internes (`LEGAL`, sentinelle `MISSING`).
- `src/components/legal/LegalPageLayout.tsx` — shell partagé + bandeau brouillon.
- `src/routes/mentions-legales.tsx`
- `src/routes/cgu.tsx`
- `src/routes/confidentialite.tsx`
- `src/routes/regles-communautaires.tsx`

## Routes

- `GET /mentions-legales` — brouillon, `noindex`.
- `GET /cgu` — brouillon, `noindex`.
- `GET /confidentialite` — brouillon, `noindex`.
- `GET /regles-communautaires` — brouillon, `noindex`.

## Composants

- `LegalPageLayout` (nouveau) — layout unique, versionnage (`LEGAL.version`), date, bandeau brouillon persistant, navigation croisée entre les quatre documents.

## Footer

Ajout d'une navigation `<nav aria-label="Documents juridiques">` avec les quatre liens
et un badge « Brouillons ». Aucun autre changement de layout, aucun réagencement.

## Inscription

**Aucune modification.** La Phase 26.1 n'a pas encore été livrée dans le dépôt
(pas de case d'âge, pas de case d'acceptation des CGU, pas de flux
`account_deletion_requests` implémenté côté UI). L'ajout d'une case d'acceptation
contractuelle nécessite une décision préalable sur l'âge minimum et une preuve
d'acceptation versionnée : renvoyé à une Phase 26.1 dédiée (ou à une réouverture)
pour ne pas collecter de fausse acceptation.

## Assistant IA

**Aucune modification.** La mention IA existante n'est pas altérée par cette phase.

## Suppression de compte

**Aucune modification.** Le flux `account_deletion_requests` est décrit honnêtement dans la
politique de confidentialité (traitement non instantané, vérification possible) mais
l'interface de demande côté membre n'est pas modifiée ici.

## Informations propriétaire manquantes

1. Identité juridique de l'éditeur : nom, statut, adresse, email de contact, immatriculation éventuelle.
2. Directeur de la publication.
3. Hébergeur contractuel : entité, adresse, contact — Lovable/Supabase sont les fournisseurs techniques, l'entité contractuelle exacte doit être confirmée.
4. Contact LCEN dédié au signalement de contenus illicites.
5. Contact données personnelles / DPO (obligatoire ou recommandé selon volume).
6. Âge minimum retenu (13, 15, 16 — impact RGPD art. 8).
7. Droit applicable et juridiction (dépend du siège de l'éditeur).
8. Politique de retrait et d'attribution des visuels/métadonnées tierces.
9. Durées de conservation définitives par catégorie de données.
10. Bases légales confirmées par finalité.
11. DPA signés avec Supabase, Resend, fournisseur IA — à collecter.

## Validation avocat

- Mentions légales (identité, hébergeur, PI, procédure LCEN).
- CGU (âge, capacité, licence UGC, responsabilité, résiliation, droit applicable, juridiction).
- Section signalement LCEN et modération.
- Formulations relatives à la future monétisation.

## Validation DPO

- Bases légales par finalité.
- Durées de conservation par catégorie.
- Transferts hors EEE et garanties associées (SCC, mesures supplémentaires).
- Rédaction des droits RGPD et procédure effective de traitement.
- Traitement IA (transparence, cache, quotas, fournisseur).
- Sous-traitants et DPA.
- Politique cookies (dépend de la Phase 26.3).

## Validation propriété intellectuelle

- Statut des métadonnées AniList et TMDB (CGU sources, redistribution, cache).
- Statut des affiches, images, synopsis.
- Politique d'attribution obligatoire à afficher (phase 26.5).
- Politique de retrait sur demande d'ayant droit.
- Périmètre commercial / non commercial post-bêta.
- Imports (MyAnimeList XML, Nautiljon parser) — statut licences des données importées.

## Versions et acceptation

- Numéro de version présent en tête de chaque page (`LEGAL.version = "0.1-draft"`).
- Date de dernière mise à jour affichée.
- **Aucune preuve d'acceptation** n'est collectée : cela nécessiterait une décision produit
  et une architecture de consentement versionné (table `legal_acceptances`, RPC dédié).
  Renvoyé à une phase ultérieure — ne pas collecter de fausse acceptation rétroactive.

## Migrations

**Aucune.**

## RLS

**Aucune modification.**

## RPC

**Aucune modification.**

## Typecheck

`bunx tsgo --noEmit` — à exécuter par la CI Lovable (build:dev automatique après chaque édition).
Les nouveaux fichiers utilisent exclusivement des types existants (React, `createFileRoute`,
tokens Tailwind du design system) et ne référencent aucune API instable.

## Lint

`bunx eslint src/lib/legal-config.ts src/components/legal src/routes/mentions-legales.tsx src/routes/cgu.tsx src/routes/confidentialite.tsx src/routes/regles-communautaires.tsx`
— à exécuter par la CI Lovable.

## Tests

Aucun test unitaire ajouté (pages statiques, sans logique). QA manuelle recommandée :
ouverture directe, refresh, mobile, desktop, dark, light, focus clavier, `noindex` présent.

## Build

`bun run build` — exécuté automatiquement par la CI Lovable.

## Tests navigateur

Non exécutés dans cette phase (sortie strictement rédactionnelle). La QA visuelle des quatre
routes est un pré-requis avant d'envisager une bascule vers un mode publiable (retrait du
bandeau brouillon).

## Tests mobile

Layout responsive hérité du design system (`max-w-3xl`, `px-4 sm:px-6 lg:px-8`, `prose`
avec tailles fluides). Vérification manuelle recommandée à 360 / 390 / 430 px.

## Non-régression

Zones potentiellement affectées :

- **Footer global** : ajout d'une ligne de navigation, aucune suppression, aucun changement
  de style structurant.
- **Route table** : quatre nouvelles routes distinctes, aucune collision.
- **Aucune autre modification** de composant, hook, route, RPC, RLS ou migration.

Zones **non testées manuellement** dans cette phase et à vérifier avant publication :
inscription, connexion, profil, forum, chat privé, chat live, Assistant IA, Founder Console,
mascotte, BackToTop, SSR complet, mobile physique.

## Preview

Rendu visuel non vérifié par capture automatisée dans cette phase.

## Shared DB

**Aucune consultation, aucune modification.**

## Production

**Aucune publication automatique.** Les pages sont accessibles en preview mais marquées
`noindex,nofollow` et portent un bandeau brouillon persistant. Toute publication réelle
suppose la levée des bloquants ci-dessus.

## Rollback

Par modification :

- Retrait de la barre de liens : reverter le bloc `<nav aria-label="Documents juridiques">` dans `src/components/layout/AppShell.tsx`.
- Retrait des documents : supprimer les quatre fichiers de route + `src/components/legal/LegalPageLayout.tsx` + `src/lib/legal-config.ts` ; le routeur se régénère automatiquement.

## Validation DPO

Points listés dans « Validation DPO » ci-dessus — non couverts par cette phase.

## Limitations

- Impossible de finaliser les mentions légales sans l'identité de l'éditeur.
- Impossible de finaliser la politique de confidentialité sans la désignation d'un contact données personnelles et sans les DPA signés.
- Impossible d'affirmer une conformité juridique globale.
- Le mécanisme cookies est explicitement renvoyé à la Phase 26.3.
- La preuve d'acceptation versionnée est renvoyée à une phase ultérieure.
- Aucune traduction (EN, JP, …) n'est fournie.

## Publication

**NON PUBLIÉ.**
