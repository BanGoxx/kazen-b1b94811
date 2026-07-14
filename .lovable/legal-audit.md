# KAZEN — Audit juridique et de conformité (Phase 26)

> Document **interne** d'audit. Ne constitue pas un avis juridique. Ne remplace ni un avocat, ni un DPO. Aucun code, aucune migration, aucune policy RLS, aucun contenu public n'a été modifié pendant cette phase.

---

## 1. Résumé exécutif

KAZEN est un service francophone de découverte et de suivi (tracking) d'anime, séries et films, actuellement en **beta contrôlée** (non monétisée). L'architecture est stable, sécurisée au niveau applicatif (RLS strict, RPC `SECURITY DEFINER`, rôles), et le produit collecte un volume significatif de **données personnelles** (comptes, listes, messages privés, chat live, forum, signalements, préférences, cache IA). Le service redistribue par ailleurs des **métadonnées et images tierces** (AniList, TMDB, potentiellement Nautiljon, YouTube) sans licence explicite documentée dans le dépôt.

Verdict de la phase (audit uniquement) : **PARTIAL** — l'inventaire est fait, les risques sont priorisés, mais plusieurs informations dépendent de décisions du propriétaire (identité éditeur, choix des sources, hébergement légal, DPO) et d'une validation juridique professionnelle.

**Risques critiques identifiés :**

- C1 — Absence de mentions légales publiques (obligation LCEN).
- C2 — Absence de politique de confidentialité et de CGU malgré la collecte de données personnelles et des UGC.
- C3 — Redistribution de posters/synopsis/métadonnées tierces sans licence formalisée et sans page d'attribution.
- C4 — Absence d'un mécanisme de consentement cookies/traceurs conforme (bannière + preuve + blocage préalable des traceurs optionnels).
- C5 — Absence de politique de conservation formalisée et de procédure documentée de réponse aux droits RGPD (art. 15–22).
- C6 — Chat live / forum / messagerie privée sans conditions d'utilisation, règles communautaires publiées, ni procédure claire de notification de contenus illicites (LCEN art. 6).
- C7 — Pas d'âge minimum affiché ni de contrôle, alors que le service est ouvert (RGPD art. 8 — mineurs).
- C8 — Traitement IA (fournisseur externe via AI Gateway) sans mention de transparence ni base légale documentée.

Aucun de ces points ne peut être résolu par cette phase d'audit seule ; ils sont routés vers les phases 26.1–26.5.

---

## 2. Périmètre

Périmètre couvert : identité éditeur, hébergement, catalogue (anime/films/séries) et fiches, images/vidéos/logos, articles, imports, profils, avis, commentaires, likes, playlists (dont collaboratives), forum, chat privé 1:1, chat live communautaire, signalements, modération, notifications internes, emails, calendrier, tracking, IA Assistant (cache + quotas), Premium Beta, monétisation future, statistiques, analytics, cookies/storage, sécurité, conservation, droits RGPD, mineurs, accessibilité, internationalisation.

Hors périmètre : rédaction finale des documents publics (CGU, politique de confidentialité, mentions légales, règles communautaires) — reportée en 26.2 ; implémentation cookies — 26.3 ; workflow modération publique — 26.4 ; matrice licences finalisée — 26.5.

## 3. Méthodologie

- Lecture du code applicatif (`src/lib/*.functions.ts`, `src/routes/*`, composants UI concernés).
- Inventaire des migrations SQL (`supabase/migrations/*`) et des tables listées dans le contexte projet.
- Inventaire des services externes référencés dans le code et l'environnement.
- Croisement avec obligations connues : RGPD, LCEN (loi 2004-575), directive ePrivacy / recommandations CNIL cookies, Code de la conso (abonnements/rétractation), DSA (services intermédiaires), obligations propriété intellectuelle (CPI).
- Classification des risques (Critique / Élevé / Moyen / Faible).

## 4. Limites de l'audit

- L'identité juridique de l'éditeur n'est pas connue (personne physique ? micro-entreprise ? société ? pays de résidence ?).
- Aucun contrat ou DPA signé avec les fournisseurs n'a été fourni à l'auditeur.
- La configuration exacte du provider email (Resend), du provider IA (via `LOVABLE_API_KEY` / AI Gateway) et de leurs zones de traitement n'a pas été vérifiée à la source.
- Aucun test dynamique effectué contre des sites tiers pour vérifier leurs CGU au jour de l'audit.
- L'audit ne constitue pas un avis juridique et doit être validé par un avocat / DPO.

---

## 5. Inventaire des fonctionnalités

| Domaine | Fonction | Statut | Données concernées |
|---|---|---|---|
| Auth | Inscription email + Google OAuth (broker Lovable) | Actif | email, uid, session |
| Profil | display_name, avatar_url, bio, préférences privacy | Actif | données perso |
| Tracking | list_items (progress, notes, rewatch, dates) | Actif | historique perso |
| Playlists | publiques/privées, collaboratives, reviews, likes | Actif | UGC public/privé |
| Forum | topics, posts, catégories, covers, reports | Actif | UGC public |
| Chat privé 1:1 | conversations, messages, block, report | Actif | correspondance privée |
| Chat live | rooms, messages, restrictions, reports | Actif | UGC public |
| Signalements | content_reports, forum_reports, chat reports | Actif | modération |
| Modération | moderation_actions, rôles, sanctions | Actif | logs modération |
| Notifications | notifications internes + prefs email | Actif | traçage engagement |
| Emails | digest, transactionnels via Resend | Actif (garde-fous) | email, contenus |
| Calendrier | AniList/TMDB, filtres "ma liste" / "favoris" | Actif | agrégats perso |
| IA Assistant | recommandations, cache, quotas 5/jour | Actif | prompts + réponses |
| Imports | MAL XML, AniList, Nautiljon (parser) | Actif | catalogue perso |
| Premium Beta | gratuit, sans paiement | Actif | tag utilisateur |
| Stats | /statistiques | Actif | agrégats perso |
| Fondateur console | outils admin, enrichment, tests | Actif (restreint) | admin |

## 6. Inventaire des données (registre simplifié)

Tables du schéma `public` identifiées (extrait, non exhaustif du code interne) :

**Identité & profil** : `profiles` (id, display_name, avatar_url, bio, accepts_chat, show_bio, roles indirects), `user_roles`, `user_public_badges`, `public_badges`, `member_email_preferences`, `member_notification_preferences`, `member_blocks`.

**Tracking & catalogue perso** : `list_items`, `media_records`, `media_enrichments`, `weekly_recap_reads`, `import_batches`, `import_items`.

**Communauté / UGC** : `playlists`, `playlist_items`, `playlist_collaborators`, `playlist_likes`, `playlist_requests`, `shared_playlist_reviews`, `fiche_reviews`, `review_replies`, `review_likes`, `reply_likes`, `forum_categories`, `forum_topics`, `forum_posts`, `fiche_correction_requests`, `media_requests`.

**Messagerie** : `chat_conversations`, `chat_participants`, `chat_messages`, `assistant_messages`.

**Chat live** : `live_chat_rooms`, `live_chat_messages`, `live_chat_member_state`.

**Modération / signalements** : `content_reports`, `forum_reports`, `moderation_actions`.

**Notifications / emails** : `member_notifications`, `email_delivery_logs`.

**IA** : `ai_assistant_settings`, `ai_assistant_usage`, `ai_assistant_cache`, `recommendation_feedback`.

**Beta** : `beta_feedback`.

**Cache technique** : `anilist_cache`.

### Catégorisation

| Table / catégorie | Type | Sensibilité | Base légale probable | Conservation cible |
|---|---|---|---|---|
| profiles | Perso directe | Moyenne (bio libre) | Exécution du contrat | Vie du compte + 30j |
| list_items / media_records / import_items | Perso (historique) | Moyenne | Exécution du contrat | Vie du compte |
| chat_messages (privés) | Correspondance privée | **Élevée** | Contrat | 12 mois glissants (à décider) |
| live_chat_messages | UGC public | Moyenne | Contrat + IL modération | 12 mois (à décider) |
| forum_posts / topics | UGC public | Moyenne | Contrat | Vie du contenu / anonymisation à suppression compte |
| fiche_reviews / review_replies | UGC public | Moyenne | Contrat | Idem |
| content_reports / moderation_actions | Modération | **Élevée** | Obligation légale (LCEN) + IL | 12 mois min recommandé (à valider) |
| email_delivery_logs | Traçabilité | Moyenne | IL sécurité + preuve | 12 mois |
| ai_assistant_usage / cache | Analyse IA | Moyenne (prompts) | Contrat + IL anti-abus | 30–90j (à décider) |
| assistant_messages | Prompts + réponses | **Élevée** (contenu libre) | Contrat | 30–90j |
| member_email_preferences | Consentement/préférences | Moyenne | Consentement + preuve | Vie du compte |
| beta_feedback | Retour utilisateur | Moyenne | IL amélioration | 24 mois |
| anilist_cache | Non perso | Faible | IL performance | 7–30j |

## 7. Inventaire des fournisseurs

| Fournisseur | Usage confirmé | Données transmises | Zone probable | DPA à obtenir | Risque |
|---|---|---|---|---|---|
| Lovable (plateforme + AI Gateway) | Hébergement app, secrets, AI proxy | Toutes (indirect) | UE/US | Oui | Élevé |
| Supabase (via Lovable Cloud) | DB, Auth, Storage, Realtime | Toutes données perso | UE (à confirmer) | Oui (via Lovable) | Élevé |
| Google (OAuth) | Sign-in social | email, profil Google | US (SCC) | Terms Google | Moyen |
| AniList (API) | Métadonnées + images | requêtes anonymisées | US/UE | CGU AniList à relire | **Élevé (PI)** |
| TMDB (API) | Métadonnées films/séries + images | requêtes anonymisées | US | Attribution obligatoire + clé | **Élevé (PI + attribution)** |
| Nautiljon (parser import) | Parsing côté client d'un export utilisateur | contenu du fichier | — | À clarifier — scraping non autorisé sans accord | **Critique (PI)** |
| MyAnimeList (import XML) | Parsing de l'export utilisateur | contenu du fichier | — | OK (données appartenant à l'utilisateur) | Faible |
| YouTube (iframes trailers, si actif) | Lecteur intégré | cookies YouTube tiers | US | Obligation consentement | Élevé (cookies) |
| Resend (email) | Envoi emails transactionnels/digest | email, contenu | US (SCC) | DPA Resend | Élevé |
| Cloudflare (via Lovable/Workers) | CDN, edge, potentiellement anti-abus | IP, headers | Global | Sous-traitant Lovable | Moyen |
| Modèle IA (via Lovable AI Gateway) | Génération recommandations | prompts + contenu | Inconnu précis | À documenter | Élevé |

Fournisseurs à confirmer / documenter : monitoring (Sentry ou équivalent — non détecté), analytics (aucun analytics tiers détecté dans le dépôt, à confirmer).

## 8. Propriété intellectuelle

### 8.1 Métadonnées catalogue

- **AniList** : API GraphQL publique. Les CGU limitent l'usage commercial et exigent que l'application ne se présente pas comme officielle. La conservation prolongée dans un cache serveur (`anilist_cache`) doit rester bornée. **Action** : relire les CGU AniList à la date de lancement et prévoir attribution.
- **TMDB** : usage soumis à obtention d'une clé API et à l'obligation d'attribution ("This product uses the TMDB API but is not endorsed or certified by TMDB.") et affichage du logo TMDB. **Action** : ajouter attribution visible et clé API dédiée.
- **Nautiljon** : pas d'API publique documentée. Toute réutilisation de contenus doit être limitée à des exports fournis par l'utilisateur lui-même. **Risque critique** en cas de scraping ou copie de fiches. À restreindre strictement à un rôle d'import client (utilisateur → sa propre liste).

### 8.2 Matrice images (à compléter par le propriétaire)

| Type | Source réelle | Licence connue | Attribution | Usage commercial | Risque | Action |
|---|---|---|---|---|---|---|
| Posters anime | AniList (CDN AniList/Anilist media) | Non documentée | À afficher | Beta non monétisée aujourd'hui | Élevé | Ajouter attribution + politique de retrait |
| Posters films/séries | TMDB | CGU TMDB | Obligatoire (logo + phrase) | Autorisé sous conditions | Élevé | Implémenter attribution TMDB |
| Avatars officiels / personnages | AniList/TMDB | Non documentée | À afficher | Idem | Élevé | Idem |
| Bannières fiches | AniList/TMDB | Idem | Idem | Idem | Élevé | Idem |
| Avatars utilisateurs | Uploads utilisateurs | Cédée via CGU (à écrire) | — | — | Moyen | Clause de licence dans CGU |
| Covers forum | Uploads utilisateurs | Idem | — | — | Moyen | Idem + modération |
| Illustrations produit / logo KAZEN | Générées / propriétaires | À confirmer | — | Autorisé | Faible | Confirmer origine |

### 8.3 Vidéos / bandes-annonces

- Intégrations YouTube (si actives) : iframes officielles → dépose des cookies tiers avant consentement → **non conforme cookies**. Nécessite mode "click-to-load" ou blocage préalable en 26.3.

### 8.4 Articles

- Le module `src/lib/news.ts` agrège des articles éditoriaux. **À clarifier** : origine réelle des articles (rédigés par KAZEN ? importés ? résumés ?). Si import : limiter à titre + lien + court extrait attribué, jamais republication complète.

## 9. Licences et attributions (à créer en 26.5)

Page publique dédiée requise : `/mentions-legales` (ou `/credits`), listant :
- attribution TMDB (phrase + logo),
- attribution AniList,
- droits des ayants droit sur œuvres/images/logos,
- mentions des bibliothèques open-source (React, TanStack, Supabase JS, Recharts, etc. — inventaire licences à générer).

Formulation à valider juridiquement : « KAZEN est un service indépendant et n'est affilié à aucun studio, éditeur ou plateforme mentionné, sauf indication contraire. »

## 10. RGPD — Registre simplifié

Voir tableau §6 pour catégories. Traitements identifiés :
1. Création/authentification compte (contrat).
2. Gestion profil public/privé (contrat).
3. Tracking personnel (contrat).
4. UGC public (forum/playlists/reviews) — contrat + IL modération.
5. Messagerie privée — contrat + confidentialité renforcée.
6. Chat live public — contrat + IL modération.
7. Signalements & modération — obligation légale (LCEN) + IL.
8. Notifications internes — contrat.
9. Emails digest — consentement (opt-in requis pour éditorial).
10. Emails transactionnels — contrat.
11. IA Assistant — contrat + IL amélioration (à documenter, cf. §13).
12. Statistiques anonymisées perso — contrat.
13. Imports — contrat (données appartenant à l'utilisateur).
14. Logs sécurité — IL sécurité.
15. Beta feedback — IL amélioration produit.

**Transferts hors EEE** : probables (Google, TMDB, AniList, Resend, provider IA). Base : SCC / adéquation à documenter.

## 11. Cookies et traceurs

Analyse initiale du dépôt : pas de bannière cookies détectée. Storage identifié :
- `localStorage` Supabase Auth (`sb-*-auth-token`) — **nécessaire** (exempté de consentement).
- Storage session pour filtres/scroll (`src/lib/catalog-state.ts`) — nécessaire, exempté.
- Storage mascotte assistant, préférences UI — nécessaire, exempté.
- Cookies OAuth Google (flux `web_message`) — nécessaire pour authentification.
- Iframes YouTube (si utilisées) — cookies tiers Google **non nécessaires**, **consentement requis avant chargement**.
- Aucun analytics tiers (GA, Matomo, PostHog) détecté à date.

**Action 26.3** : bannière conforme (accepter / refuser / personnaliser au même niveau), preuve de consentement horodatée (table dédiée), blocage effectif préalable des embeds vidéo et de tout futur analytics, lien "gérer mes cookies" persistant en footer.

## 12. Droits utilisateurs

| Droit | État actuel | Écart | Action |
|---|---|---|---|
| Accès (art. 15) | Export JSON/CSV via `src/lib/export.functions.ts` | Partiel : ne couvre pas messages privés + signalements | Étendre export ou documenter portée |
| Rectification (art. 16) | UI profil / listes | OK partiel | Doc procédure |
| Effacement (art. 17) | **Aucune UI de suppression de compte confirmée** | Écart critique | Créer fonction "supprimer mon compte" (phase ultérieure) |
| Opposition (art. 21) | Opt-out email partiel | Écart pour IL modération/logs | Formaliser refus + résiliation |
| Limitation (art. 18) | Non implémentée | Écart | Procédure interne DPO |
| Portabilité (art. 20) | Export JSON présent | OK partiel | Vérifier format lisible machine |
| Retrait du consentement (art. 7) | Préférences email OK | Écart cookies | 26.3 |
| Réclamation CNIL | Doit être mentionnée | — | 26.2 |

## 13. Conservation des données (proposition à valider)

| Donnée | Durée proposée | Déclencheur suppression |
|---|---|---|
| Compte actif | Tant que le compte est actif | — |
| Compte inactif > 24 mois | Notification puis suppression | Inactivité |
| Profil (data perso) | Vie du compte + 30j (grâce) | Suppression compte |
| Tracking / listes | Vie du compte | Suppression compte |
| Playlists publiques | Anonymisées ou supprimées à la suppression du compte | Suppression compte |
| Forum / reviews | Anonymisation (auteur → "Utilisateur supprimé") | Suppression compte |
| Chat privé | 12 mois glissants, suppression au retrait de compte | Retrait / expiration |
| Chat live | 12 mois glissants | Idem |
| Signalements & actions modération | 12 mois min (à valider DPO) | Politique modération |
| Logs sécurité | 6–12 mois | Politique sécurité |
| Cache IA | 30–90j | Fenêtre glissante |
| Prompts + réponses IA | 30–90j | Idem |
| Emails logs | 12 mois | Politique |
| Beta feedback | 24 mois | Fin phase Beta |
| anilist_cache | 7–30j | TTL |
| Preuves de consentement | 3 ans après retrait | Obligation preuve |

## 14. Chat & forum

Rôle : KAZEN est **hébergeur** des UGC au sens LCEN art. 6. Obligations :
- afficher clairement les mentions LCEN (éditeur, hébergeur, contact) ;
- disposer d'un dispositif de signalement facilement accessible pour chaque contenu ;
- retirer promptement un contenu manifestement illicite après notification ;
- conserver les données permettant l'identification (durée à confirmer, historiquement 12 mois) ;
- pouvoir répondre aux réquisitions judiciaires.

État présent : signalement, blocage, modération, logs → majoritairement en place. **Écarts** : règles communautaires publiques non publiées, mentions LCEN absentes, procédure de notification standardisée (LCEN art. 6-I-5) non formalisée, DSA (art. 16 notice-and-action) à évaluer selon audience.

## 15. Modération

- Rôles présents (`user_roles`, `has_role`, `can_moderate_now`).
- Journal `moderation_actions` présent.
- Actions supportées : hide, unhide, soft_delete, restore, lock, unlock, warn, timeout, dismiss_report.
- **Écart** : pas de procédure d'appel documentée pour l'utilisateur sanctionné (recommandé DSA).
- **Écart** : pas de politique publique de sanctions.

## 16. Utilisateurs mineurs

- Aucun contrôle d'âge à l'inscription.
- Chat live et messagerie privée ouverts par défaut.
- RGPD art. 8 : consentement parental requis en France en-dessous de 15 ans.
- **Décision produit requise** : âge minimum (recommandation : 15 ans en France, cohérent avec la CNIL) + affichage + case déclarative + refus si < seuil.
- Impact : messagerie privée + chat live = surfaces à risque élevé.

## 17. IA Assistant

- Fournisseur : via Lovable AI Gateway (modèle exact à documenter).
- Données envoyées : prompts utilisateur, contexte de recommandation (potentiellement liste privée), pas d'identifiant nominatif nécessaire.
- Stockage : `assistant_messages`, `ai_assistant_cache`, `ai_assistant_usage`, `recommendation_feedback`.
- Quotas : 5/jour.
- **Écarts** :
  - transparence : mention "assistée par IA" à afficher clairement ;
  - base légale : contrat + IL (à documenter) ;
  - conservation : bornée à définir ;
  - kill switch : `ai_assistant_settings` semble présent, à valider fonctionnellement ;
  - décisions automatisées (art. 22) : recommandations ne produisent pas d'effet juridique → non concerné a priori, mais à afficher tel quel ;
  - contenus interdits / hallucinations : disclaimer visible requis.

## 18. Notifications, emails, SMS

- Notifications internes : contrat, opt-out granulaire présent (`member_notification_preferences`).
- Emails transactionnels : contrat.
- Digest éditorial : **consentement requis** (opt-in). `member_email_preferences` présent — vérifier que l'opt-in est *actif* (pas pré-coché) et que la preuve est conservée.
- SMS : non implémenté (aucun fournisseur détecté). Aucune action requise avant activation.

## 19. Monétisation future (KAZEN Plus)

- Premium Beta actuellement **gratuit**, aucun paiement.
- Positionnement : 0,99 € puis 1,99 € annoncé de manière indicative.
- Obligations à prévoir pour la phase paiement :
  - information précontractuelle (Code conso art. L.221-5) ;
  - CGV distinctes des CGU ;
  - droit de rétractation 14j et exception si exécution immédiate avec accord + renoncement exprès ;
  - reconduction tacite et information (loi Chatel) ;
  - facture / TVA (dépend du régime éditeur) ;
  - Stripe DPA ;
  - clarification statut auteur/éditeur (micro-entreprise, société) ;
  - pas de "dark pattern" à la résiliation, tunnel de résiliation en ligne (loi française) ;
  - migration Beta → payant : information préalable claire, opt-in explicite.

**À ne pas implémenter en Phase 26.** Checklist à traiter en Phase 30.

## 20. Sécurité et violations

Éléments constatés :
- RLS en place sur tables publiques (SELECT-only côté public).
- RPC `SECURITY DEFINER` avec `search_path=public` pour opérations privilégiées.
- Rôles séparés (`user_roles` + `has_role`).
- Realtime limité à `live_chat_messages`.
- `get_public_profile` filtre selon `show_bio`.
- Bloc `member_blocks` pour messagerie.

Écarts :
- pas de procédure documentée de gestion d'incident (détection, containment, notification CNIL sous 72h art. 33, notification utilisateurs art. 34) ;
- pas de journal centralisé formalisé d'audit d'accès Founder ;
- rate-limiting applicatif partiel (via quotas IA, RPC), à cartographier ;
- pas de plan de sauvegarde/restauration documenté côté KAZEN (dépend de Supabase → à obtenir DPA).

## 21. Internationalisation

- Interface actuellement en français uniquement (choix produit).
- Ouverture EN/autres langues envisagée : impact CGU/PC à traduire, UK GDPR séparé, éventuellement DSA, obligations consommateur locales, TVA MOSS pour abonnements, disponibilité régionale des plateformes tierces.
- Décision produit : maintenir France/UE d'abord, documenter juridiction (France) et loi applicable dans les CGU.

## 22. Mentions légales publiques nécessaires (à créer en 26.2)

Contenu à préparer (informations à collecter auprès du propriétaire) :
- dénomination éditeur, forme juridique ;
- adresse postale ;
- email de contact ;
- SIREN/SIRET si applicable ;
- directeur de la publication ;
- hébergeur (Lovable + coordonnées) ;
- contact DPO ou référent données ;
- contact signalement contenu illicite (LCEN art. 6-III) ;
- attribution TMDB / AniList ;
- droit d'auteur, marques.

## 23. Documents juridiques nécessaires (26.2)

- CGU (dont clauses UGC, licence non exclusive utilisateur → KAZEN nécessaire pour redistribuer les UGC, comportements interdits, sanctions, résiliation).
- Politique de confidentialité (bases légales, durées, droits, DPO, réclamation CNIL).
- Politique cookies (26.3).
- Règles communautaires (26.4).
- CGV Premium (Phase 30).
- Charte modération (interne, exposée partiellement).

## 24. Matrice des risques

| ID | Domaine | Description | Niveau | Phase cible | Propriétaire |
|---|---|---|---|---|---|
| C1 | Mentions légales | Absentes publiquement (LCEN) | **Critique** | 26.2 | Owner + avocat |
| C2 | CGU + PC | Absentes malgré UGC + data perso | **Critique** | 26.2 | Owner + avocat |
| C3 | Licences catalogue | Images/synopsis redistribués sans attribution formelle | **Critique** | 26.5 | Owner |
| C4 | Cookies | Pas de bannière conforme, embeds tiers non gated | **Critique** | 26.3 | Dev |
| C5 | RGPD droits/conservation | Politiques non formalisées, suppression compte manquante | **Critique** | 26.1 + 26.2 | Dev + DPO |
| C6 | LCEN hébergeur | Pas de dispositif de notification formalisé | **Critique** | 26.4 | Dev + juriste |
| C7 | Mineurs | Pas d'âge minimum ni contrôle | **Critique** | 26.1 | Owner |
| C8 | IA transparence | Mention et base légale non affichées | Élevé | 26.2 | Dev |
| E1 | TMDB attribution | Attribution obligatoire absente | Élevé | 26.5 | Dev |
| E2 | AniList branding | Non-affiliation à préciser | Élevé | 26.5 | Dev |
| E3 | Nautiljon | Parser à restreindre strictement à un import fichier utilisateur, jamais serveur | Élevé | 26.5 | Dev |
| E4 | Messages privés | Conservation non bornée | Élevé | 26.1 | Dev + DPO |
| E5 | Modération appel | Pas de procédure d'appel utilisateur | Élevé | 26.4 | Owner |
| M1 | Analytics | Pas d'analytics déclaré — vérifier | Moyen | 26.3 | Dev |
| M2 | DPA fournisseurs | À collecter (Lovable, Resend, Google, provider IA) | Moyen | 26.1 | Owner |
| M3 | Accessibilité | Audit WCAG non fait | Moyen | Ultérieur | Dev |
| M4 | Loi Chatel / résiliation | À anticiper avant Premium payant | Moyen | Phase 30 | Owner |
| F1 | Beta feedback | Durée non fixée | Faible | 26.1 | Dev |
| F2 | Cache anilist | TTL à formaliser | Faible | 26.1 | Dev |

## 25. Plan de remédiation

### Phase 26.1 — Corrections critiques techniques/produit

- Ajouter parcours **"supprimer mon compte"** (anonymisation UGC + purge data perso).
- Formaliser politique de conservation dans le code (crons/jobs de purge planifiés).
- Décider et implémenter **âge minimum** à l'inscription (case déclarative + refus si < seuil, cf. C7).
- Documenter la portée exacte de l'export utilisateur et l'étendre si nécessaire.
- Restreindre explicitement le parser Nautiljon au fichier fourni par l'utilisateur (déjà vraisemblablement le cas — à confirmer et documenter).
- Collecter les DPA Lovable / Supabase / Resend / provider IA / Google.
- Cartographier rate-limiting et documenter procédure incident.

### Phase 26.2 — Documents publics

- Rédiger mentions légales, CGU, politique de confidentialité, page attributions/crédits.
- Route publique `/mentions-legales`, `/cgu`, `/confidentialite`, `/attributions`.
- Footer global avec liens.
- Bloc "assistée par IA" et disclaimer.
- Base : validation avocat obligatoire avant publication.

### Phase 26.3 — Cookies et consentement

- Bannière conforme (Accepter / Refuser / Personnaliser au même niveau visuel).
- Blocage préalable des embeds YouTube et de tout analytics futur.
- Preuve horodatée (table dédiée à créer).
- Lien "gérer mes cookies" persistant en footer.

### Phase 26.4 — Forum, chat, signalement, modération

- Publier règles communautaires.
- Formulaire de notification LCEN standardisé (identité, contenu incriminé, motifs, déclaration sur l'honneur).
- Procédure d'appel utilisateur pour les sanctions.
- Journal d'audit accessible aux modérateurs.
- Politique de rétention modération.

### Phase 26.5 — Licences, sources, images, articles

- Attribution TMDB (logo + phrase) visible sur fiches et page attributions.
- Attribution AniList.
- Mention de non-affiliation.
- Cartographie licences open-source (générer inventaire NPM + SPDX).
- Politique de retrait (contact + délai).
- Politique articles : titre + résumé original + lien source, jamais republication complète.

## 26. Dépendances

- Identité juridique éditeur → bloque 26.2.
- Choix âge minimum → bloque 26.1 (partie mineurs) et 26.2.
- Choix hébergeur mentionné (Lovable/Cloudflare/Supabase — à formuler) → bloque 26.2.
- DPA fournisseurs → bloque politique de confidentialité complète.
- Validation avocat → bloque publication 26.2.

## 27. Décisions à prendre par le propriétaire

1. Structure juridique éditeur (personne physique / micro-entreprise / société).
2. Adresse et contact publics.
3. Directeur de la publication.
4. Référent données / DPO.
5. Contact signalement LCEN.
6. Âge minimum d'inscription (recommandation : 15 ans).
7. Modèle de monétisation confirmé et pays de commercialisation (avant Phase 30).
8. Choix conserver ou retirer YouTube embed / autres embeds tiers.
9. Politique articles : rédaction originale ou source tierce ?
10. Budget pour avocat + DPO externe.
11. Politique de rétention exacte (validation par DPO).
12. Ouverture internationale : périmètre géographique cible à 6/12 mois.

## 28. Points nécessitant un avocat / DPO / expert

- Rédaction CGU / PC / mentions légales / CGV.
- Analyse de mise en balance des intérêts légitimes (modération, IA, anti-abus).
- Validation politique de rétention et procédure droits RGPD.
- Analyse LCEN / DSA (statut hébergeur, seuils DSA le cas échéant).
- Analyse propriété intellectuelle des sources (AniList, TMDB, Nautiljon).
- Analyse risque marque KAZEN (recherche d'antériorité INPI/EUIPO).
- Analyse consommation abonnements avant Phase 30.
- Analyse traitements IA (transparence, base légale, transferts, sous-traitants).

## 29. Critères de lancement (release gate)

Lancement public élargi acceptable seulement si :
- 26.1 fermée (suppression compte + âge minimum + conservation).
- 26.2 publiée et validée avocat.
- 26.3 fermée (consentement cookies effectif).
- 26.4 fermée (règles + LCEN + procédure appel).
- 26.5 fermée (attributions publiques).
- DPA fournisseurs archivés.
- Procédure incident documentée.

## 30. Verdict final

Voir section rapport final ci-dessous.

---

# Rapport final

## Verdict

**PARTIAL**

## Signification du verdict

Concerne **uniquement l'achèvement de l'audit**. Ne signifie **pas** que KAZEN est juridiquement conforme.

## Cause

Audit et cartographie complets réalisés à partir du code, des migrations et des fonctionnalités confirmées. Certains éléments dépendent d'informations extérieures au dépôt (identité juridique éditeur, DPA fournisseurs, décisions produit sur l'âge minimum et sur les sources d'articles) et ne peuvent être finalisés dans cette phase. Aucune conformité juridique définitive n'a été affirmée. Un plan de remédiation priorisé (26.1 → 26.5) est livré.

## Fichier créé

`.lovable/legal-audit.md`

## Code

Aucun code applicatif modifié.

## Fichiers modifiés

- `.lovable/legal-audit.md` (créé)

## Migrations

Aucune.

## RLS

Aucune modification.

## RPC

Aucune modification.

## Routes

Aucune modification.

## Données personnelles

Identité (email, uid), profil (display_name, avatar, bio), historique de tracking, UGC public (playlists, reviews, forum, chat live), correspondance privée (chat 1:1), prompts IA, signalements, préférences email/notifications, logs email, feedback beta, imports.

## Fournisseurs

Lovable (hébergement + AI Gateway), Supabase (DB/Auth/Storage/Realtime), Google OAuth, AniList, TMDB, Resend, Cloudflare (via Lovable), potentiellement YouTube (embeds), provider IA sous Lovable AI Gateway. Nautiljon uniquement en parser client d'exports utilisateurs. Analytics tiers non détectés.

## Licences

Risques majeurs sur images et synopsis catalogues (AniList/TMDB) sans attribution formelle. TMDB requiert attribution obligatoire. Nautiljon à cantonner strictement à un rôle d'import client. Articles à sourcer clairement (limiter à extraits + lien) ou à rédiger en propre.

## Cookies

Aucune bannière conforme. Storages nécessaires uniquement (auth Supabase, préférences UI) présents. Embeds YouTube et tout analytics futur nécessiteront consentement préalable + blocage.

## Chat et forum

KAZEN est hébergeur au sens LCEN. Signalement/modération techniquement en place. Manquent : règles communautaires publiques, formulaire de notification LCEN standardisé, procédure d'appel utilisateur, politique de rétention.

## IA

Traitement via Lovable AI Gateway, prompts et cache stockés. Mention "assistée par IA" et base légale à afficher. Pas de décision automatisée à effet juridique. Kill switch et quotas déjà en place.

## Monétisation

Actuellement gratuit. Avant tout paiement : CGV, information précontractuelle, droit de rétractation, loi Chatel, tunnel de résiliation en ligne, TVA, Stripe DPA. Rien à implémenter en Phase 26.

## Risques critiques

C1 mentions légales / C2 CGU+PC / C3 licences catalogue / C4 cookies / C5 droits+conservation+suppression compte / C6 LCEN hébergeur / C7 mineurs / C8 transparence IA.

## Informations manquantes

Identité juridique éditeur, adresse, SIREN/SIRET, directeur publication, DPO, contact LCEN, DPA de tous les fournisseurs, choix d'âge minimum, choix embeds tiers, origine réelle des articles éditoriaux, budget conseil juridique.

## Décisions propriétaire

Voir §27 (12 décisions listées).

## Validation professionnelle

Avocat pour CGU/PC/mentions légales/CGV, DPO pour rétention et IL, expert PI pour matrice licences, recherche marque INPI/EUIPO pour "KAZEN".

## Preview

Aucun changement visuel.

## Shared DB

Consultée en lecture seule via la liste des tables fournie dans le contexte. Aucune modification.

## Production

Aucune publication automatique.

## Rollback

Aucun rollback nécessaire (seul un document d'audit a été créé).

## Limitations

Pas d'accès aux contrats/DPA signés. Pas de vérification dynamique des CGU des tiers au jour de l'audit. L'audit ne remplace pas un avis juridique.

## Publication

NON PUBLIÉ.
