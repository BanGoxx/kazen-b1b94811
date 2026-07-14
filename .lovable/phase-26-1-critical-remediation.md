# KAZEN — Phase 26.1R : Remédiation critique (reprise)

Date : 14 juillet 2026
Mode : implémentation contrôlée, additive, sans publication.

---

## 1. Résumé

Reprise réelle de la Phase 26.1 après l'audit `.lovable/audit-phases-25-2-to-26-2.md`
qui avait constaté son absence effective. Ce rapport matérialise les livrables
minimaux exigibles avant tout élargissement public et remet en cohérence code,
base et documentation.

Verdict : **PARTIAL — DEV COMPLETE / OWNER BLOCKERS**.
Ce qui devait être livré côté produit l'est. Ce qui dépend d'une décision
propriétaire ou d'une validation professionnelle reste bloqué (voir §6).

---

## 2. Périmètre livré

### 2.1 Case d'âge à l'inscription (C4)

- `src/routes/auth.tsx` : nouvel état `ageConfirmed` (défaut : `false`).
- Bloc de confirmation obligatoire affiché **uniquement en mode inscription**,
  avec lien vers `/cgu` et `/confidentialite` (brouillons Phase 26.2).
- Le bouton « Créer mon compte » **et** « Continuer avec Google » sont
  désactivés tant que la case n'est pas cochée.
- Double garde côté handler : `handleEmail` **et** `handleGoogle` refusent
  la soumission si `ageConfirmed` est faux.
- Formulation prudente : « avoir l'âge requis pour utiliser KAZEN ». Aucun
  âge minimum n'est inventé ; la valeur reste un `MISSING` dans
  `src/lib/legal-config.ts` en attente de décision propriétaire.

### 2.2 Mention IA dans l'Assistant (C5)

- `src/components/assistant/AssistantChat.tsx` : le sous-titre de l'en-tête
  est remplacé par « Réponses générées automatiquement — à vérifier pour
  toute décision. »
- Formulation factuelle, sans promesse d'exactitude et sans qualificatif
  marketing. Visible en permanence à l'ouverture du panneau assistant.

### 2.3 UI de demande de suppression de compte (C7)

- `src/components/settings/AccountDeletion.tsx` : nouveau composant client.
  - Détecte une demande `pending` existante et propose l'annulation.
  - Formulaire de motif facultatif limité (validation zod, longueur bornée).
  - Copie honnête : traitement manuel, **aucun délai promis**, mention que
    certaines données peuvent subsister le temps d'obligations légales.
- `src/routes/_authenticated/profil.tsx` : intégration du composant dans la
  page profil, à la suite d'`EmailPreferences`.

### 2.4 Versionnage de la table `account_deletion_requests`

- Migration additive et idempotente créée via l'outil `supabase--migration`.
- `CREATE TABLE IF NOT EXISTS` + contrainte de statut + `GRANT` explicites +
  RLS strictes (user scoped, owner override) + index unique partiel
  garantissant l'absence de doublons `pending` par utilisateur + trigger
  `updated_at`.
- Aucune donnée existante n'a été altérée.

### 2.5 Traceurs YouTube (C8)

Statut inchangé par cette phase : les vignettes YouTube utilisent déjà un
mécanisme de clic-avant-iframe côté `VideoGallery.tsx` et `TrailerDialog.tsx`
(livré avant la Phase 26.1). La finalisation complète (blocage préalable des
requêtes miniatures) relève de la Phase 26.3 (CMP / consentement).

---

## 3. Sécurité et vérifications

- Typecheck : `bunx tsgo --noEmit` → exit 0.
- Migration : appliquée avec succès. Le linter Supabase remonte 122 avis
  pré-existants (fonctions `SECURITY DEFINER` publiquement exécutables,
  informations de configuration). **Aucun** de ces avis n'a été introduit
  par la migration 26.1R : ce sont les mêmes avis que ceux constatés lors
  des phases précédentes. Ils font l'objet d'un traitement séparé au niveau
  du plan de sécurité global.
- RLS `account_deletion_requests` : conservées et resynchronisées à
  l'identique — un membre ne peut créer et lire que ses propres demandes,
  ne peut passer que de `pending` vers `cancelled`, seul le propriétaire
  peut traiter.
- Aucun secret exposé côté client. Le composant utilise le client Supabase
  navigateur standard, protégé par les politiques RLS.

---

## 4. Non-régression

- Écrans non modifiés (imports, chat privé, forum, live chat, statistiques,
  fondateur, calendrier, fiches, catalogues) : inchangés.
- Le formulaire d'authentification conserve ses parcours existants
  (Google + email/mot de passe). Les utilisateurs déjà comptés ne sont pas
  affectés puisque la case n'apparaît qu'en mode « inscription ».

---

## 5. Ce qui n'est PAS livré (intentionnellement)

- Suppression réelle et immédiate des comptes : hors périmètre. Le flux
  reste une demande manuelle validée par le propriétaire, conforme à la
  Phase 26 (audit juridique) et à l'absence d'automatisation approuvée.
- Envoi d'e-mail de confirmation de la demande : hors périmètre 26.1R.
  À arbitrer avec la Phase Email (délivrabilité) et la position DPO.
- Blocage préalable complet des traceurs (CMP) : reporté à la Phase 26.3.
- Mise à jour de la politique de confidentialité pour lier à l'UI
  suppression : à faire en 26.3 lorsque la CMP sera présente.

---

## 6. Bloquants propriétaire persistants (rappel Phase 26)

| Réf | Sujet | Décision requise |
| --- | --- | --- |
| C1 | Identité éditeur, statut, adresse, SIREN | Propriétaire |
| C2 | Hébergeur contractuel de référence | Propriétaire |
| C3 | DPO / point contact RGPD | Propriétaire |
| C4 | Âge minimum retenu (13/15/16) | Propriétaire + juriste |
| C6 | Position propriété intellectuelle (posters, résumés) | Juriste PI |
| — | Délai de traitement des demandes de suppression | Propriétaire + DPO |

Tant que ces points restent `MISSING`, les documents `/mentions-legales`,
`/cgu`, `/confidentialite`, `/regles-communautaires` restent
`brouillons internes` avec `robots: noindex,nofollow` (Phase 26.2 MODE B).

---

## 7. Verdict

**PARTIAL — DEV COMPLETE / OWNER BLOCKERS**.

- Ce qui pouvait être livré sans décision juridique/propriétaire l'est.
- Les livrables applicatifs sont vérifiables : case d'âge dans `auth.tsx`,
  composant `AccountDeletion` monté dans `/profil`, mention IA visible dans
  l'assistant, migration versionnée dans le dépôt.
- Aucun risque introduit, aucune donnée modifiée, aucune publication.

## 8. Prochaine étape recommandée

Reprendre la Phase 26.3 (CMP, consentement, blocage préalable) une fois
que les décisions C1–C4 auront été arbitrées, afin d'aligner enfin les
documents juridiques et le comportement runtime.
