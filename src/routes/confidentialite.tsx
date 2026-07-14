import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LEGAL } from "@/lib/legal-config";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité (brouillon) — KAZEN" },
      { name: "description", content: "Politique de confidentialité de KAZEN — brouillon en cours de finalisation." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ConfidentialitePage,
});

function ConfidentialitePage() {
  return (
    <LegalPageLayout
      title="Politique de confidentialité"
      subtitle="Traitement des données personnelles des utilisateurs de KAZEN."
    >
      <section>
        <h2>1. Responsable du traitement</h2>
        <ul>
          <li><strong>Éditeur :</strong> {LEGAL.publisherName}</li>
          <li><strong>Adresse :</strong> {LEGAL.publisherAddress}</li>
          <li><strong>Contact données personnelles :</strong> {LEGAL.dpoContact}</li>
        </ul>
        <p>
          Ces informations dépendent de la confirmation de l'identité de l'éditeur et de la désignation
          éventuelle d'un DPO.
        </p>
      </section>

      <section>
        <h2>2. Données collectées</h2>
        <p>
          Selon l'utilisation faite du service, KAZEN peut traiter les catégories de données suivantes :
        </p>
        <ul>
          <li><strong>Compte :</strong> adresse e-mail, identifiant unique, pseudonyme, avatar, biographie, préférences de confidentialité, rôles.</li>
          <li><strong>Tracking :</strong> listes personnelles, progression, notes, dates, rewatch, favoris.</li>
          <li><strong>Contenus communautaires :</strong> playlists, avis, commentaires, likes, messages de forum, messages de chat privé, messages de chat live.</li>
          <li><strong>Modération :</strong> signalements, actions de modération, blocages entre membres.</li>
          <li><strong>Notifications :</strong> notifications internes, préférences email et notifications.</li>
          <li><strong>Imports :</strong> lots d'import (MyAnimeList, AniList, Nautiljon), éléments importés.</li>
          <li><strong>Assistant IA :</strong> prompts, réponses, cache technique, quotas quotidiens.</li>
          <li><strong>Emails :</strong> digest, transactionnels via un fournisseur d'envoi tiers.</li>
          <li><strong>Statistiques personnelles :</strong> agrégats calculés à partir des listes.</li>
          <li><strong>Premium Bêta :</strong> statut d'accès, sans facturation.</li>
          <li><strong>Données techniques :</strong> stockage local minimal indispensable au service.</li>
        </ul>
      </section>

      <section>
        <h2>3. Finalités</h2>
        <ul>
          <li>Fournir et exploiter le service (comptes, tracking, catalogue, imports).</li>
          <li>Authentification et sécurité des accès.</li>
          <li>Personnalisation (recommandations, préférences).</li>
          <li>Fonctionnement des espaces communautaires (forum, chats, playlists).</li>
          <li>Modération et prévention des abus.</li>
          <li>Communication (notifications internes, emails opérationnels et digest).</li>
          <li>Support et gestion des demandes RGPD.</li>
          <li>Assistant IA (traitement automatisé des demandes explicites).</li>
        </ul>
      </section>

      <section>
        <h2>4. Bases légales</h2>
        <p>
          Selon la finalité concernée, les traitements peuvent reposer sur : l'exécution du contrat
          (compte, tracking, fonctionnalités demandées), l'intérêt légitime (sécurité, prévention des
          abus, modération), le consentement (envois marketing éventuels, traceurs optionnels
          — phase 26.3), ou une obligation légale (conservation minimale requise).
        </p>
        <p>
          La qualification exacte de chaque base légale sera confirmée avec un DPO ou un spécialiste
          RGPD avant finalisation.
        </p>
      </section>

      <section>
        <h2>5. Destinataires et sous-traitants</h2>
        <p>
          Les données peuvent être traitées par les fournisseurs techniques suivants dans le cadre
          strict du service :
        </p>
        <ul>
          <li><strong>Hébergement et base de données :</strong> Supabase (via Lovable).</li>
          <li><strong>Envoi d'emails :</strong> Resend (garde-fous activés en attente de domaine vérifié).</li>
          <li><strong>Assistant IA :</strong> AI Gateway Lovable / fournisseur de modèle sous-jacent.</li>
          <li><strong>Authentification tierce :</strong> Google OAuth, si l'utilisateur choisit cette option.</li>
          <li><strong>Métadonnées catalogue :</strong> AniList, TMDB (sources publiques, non destinataires des données personnelles utilisateurs).</li>
        </ul>
        <p>
          Les contrats de sous-traitance et DPA associés seront collectés et référencés lors de la
          finalisation.
        </p>
      </section>

      <section>
        <h2>6. Transferts hors EEE</h2>
        <p>
          Certains fournisseurs listés ci-dessus peuvent opérer des transferts hors Espace économique
          européen. Les garanties contractuelles (clauses contractuelles types, mesures supplémentaires)
          seront documentées après vérification auprès de chaque prestataire. En l'état, aucune absence
          de transfert ne peut être affirmée.
        </p>
      </section>

      <section>
        <h2>7. Durées de conservation</h2>
        <p>
          Les durées définitives sont en cours de finalisation. Principes retenus à ce stade :
        </p>
        <ul>
          <li>Compte : tant que le compte est actif ; suppression selon la procédure de demande.</li>
          <li>Contenus publics (forum, avis, playlists partagées) : conservés tant qu'ils ne sont pas retirés ; anonymisation ou suppression selon politique confirmée après suppression du compte.</li>
          <li>Messages privés : conservés selon les besoins du service et les obligations légales éventuelles.</li>
          <li>Signalements et actions de modération : conservés pour des raisons de sécurité et de traçabilité.</li>
          <li>Cache IA : durée technique limitée.</li>
          <li>Logs techniques : durée minimale nécessaire à la sécurité et au débogage.</li>
        </ul>
      </section>

      <section>
        <h2>8. Vos droits</h2>
        <p>
          Vous disposez, dans les conditions prévues par le RGPD, des droits suivants : accès,
          rectification, effacement, opposition, limitation, portabilité, retrait du consentement,
          définition de directives post-mortem, et réclamation auprès de l'autorité de contrôle
          compétente (en France : CNIL).
        </p>
        <p>
          <strong>Suppression du compte :</strong> une demande enregistrée depuis l'interface génère
          une entrée dans le registre interne <code>account_deletion_requests</code>. Le traitement
          n'est pas nécessairement instantané et peut nécessiter une vérification. Certaines données
          peuvent être conservées de manière anonymisée ou pour répondre à des obligations légales.
        </p>
        <p>
          Pour toute demande, contactez : {LEGAL.dpoContact}.
        </p>
      </section>

      <section>
        <h2>9. Profils publics et contenus communautaires</h2>
        <p>
          Certains éléments (pseudonyme, avatar, biographie selon vos préférences, contributions au
          forum, playlists publiques, avis) peuvent être visibles publiquement. Les paramètres de
          confidentialité de votre profil vous permettent de limiter l'exposition de certaines
          informations (biographie, disponibilité au chat).
        </p>
      </section>

      <section>
        <h2>10. Assistant IA</h2>
        <p>
          Vos demandes à l'assistant sont transmises à un fournisseur de modèle via un gateway
          technique. Elles peuvent être mises en cache techniquement pour limiter les coûts et la
          latence, et sont soumises à un quota quotidien. L'assistant peut se tromper et n'émet aucune
          décision juridique automatisée à votre encontre.
        </p>
      </section>

      <section>
        <h2>11. Sécurité</h2>
        <p>
          Mesures générales appliquées : authentification, contrôle d'accès, politiques de sécurité
          au niveau de la base (RLS), restrictions des fonctions serveur (RPC), journalisation, mesures
          anti-abus (quotas, blocages), principe de moindre privilège.
        </p>
      </section>

      <section>
        <h2>12. Cookies, stockages et contenus externes</h2>
        <p>
          KAZEN limite volontairement l'usage des stockages navigateur et n'intègre
          actuellement aucun outil de mesure d'audience, aucun traceur publicitaire
          et aucun widget social embarqué.
        </p>
        <ul>
          <li><strong>Strictement nécessaires (toujours actifs) :</strong> jeton d'authentification Supabase (localStorage), préférence de thème, préférence de consentement, état de session du catalogue (sessionStorage).</li>
          <li><strong>Contenus externes (optionnels, désactivés par défaut) :</strong> lecteurs et miniatures YouTube pour les bandes-annonces. Aucune requête n'est envoyée à YouTube tant que vous ne l'avez pas autorisé, soit globalement depuis vos préférences, soit ponctuellement en cliquant sur une vidéo précise.</li>
        </ul>
        <p>
          Vous pouvez consulter et modifier vos choix à tout moment via le
          lien « Gérer mes cookies » dans le pied de page. Le refus est aussi
          simple que l'acceptation et n'affecte pas les fonctions essentielles
          (compte, tracking, navigation, communauté).
        </p>
      </section>

      <section>
        <h2>13. Mineurs</h2>
        <p>
          Âge minimum d'utilisation : {LEGAL.minimumAge}. Cette valeur sera confirmée avant la
          finalisation du document.
        </p>
      </section>
    </LegalPageLayout>
  );
}
