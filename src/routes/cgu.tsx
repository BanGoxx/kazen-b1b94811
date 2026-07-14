import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LEGAL } from "@/lib/legal-config";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions générales d'utilisation (brouillon) — KAZEN" },
      { name: "description", content: "Conditions générales d'utilisation de KAZEN — brouillon en cours de finalisation." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CguPage,
});

function CguPage() {
  return (
    <LegalPageLayout
      title="Conditions générales d'utilisation"
      subtitle="Règles contractuelles applicables à l'utilisation du service KAZEN."
    >
      <section>
        <h2>1. Objet</h2>
        <p>
          KAZEN est un service francophone de découverte et de suivi d'anime, séries et films. Il propose,
          selon les évolutions du service : un catalogue de fiches, des listes personnelles de suivi, des
          playlists (individuelles et collaboratives), des recommandations, des profils publics, des avis
          et commentaires, un forum, une messagerie privée entre membres, un chat live communautaire, des
          notifications, un assistant IA, des outils d'import (MyAnimeList, AniList, Nautiljon) et un accès
          Premium actuellement offert dans le cadre d'une bêta contrôlée.
        </p>
      </section>

      <section>
        <h2>2. Accès au service</h2>
        <p>
          L'accès à KAZEN nécessite une connexion Internet et un navigateur compatible. La création d'un
          compte est requise pour la plupart des fonctionnalités personnelles et communautaires.
        </p>
        <p>
          L'utilisateur s'engage à fournir des informations exactes lors de son inscription et à préserver
          la confidentialité de ses identifiants. Toute action effectuée depuis un compte est présumée
          effectuée par son titulaire.
        </p>
        <p>
          KAZEN peut interrompre temporairement le service pour maintenance, mise à jour ou raison de
          sécurité, sans garantie de disponibilité absolue.
        </p>
      </section>

      <section>
        <h2>3. Âge et capacité</h2>
        <p>
          Âge minimum requis : {LEGAL.minimumAge}.
        </p>
        <p>
          Cette valeur est en cours de décision et sera confirmée avant la finalisation du présent
          document, notamment au regard de l'article 8 du RGPD.
        </p>
      </section>

      <section>
        <h2>4. Compte utilisateur</h2>
        <p>
          Chaque membre peut personnaliser son profil (pseudonyme, avatar, biographie, préférences de
          confidentialité). Il peut demander la suppression de son compte via le mécanisme prévu à cet
          effet : cette demande génère une entrée dans un registre interne (« account deletion requests »)
          et sera traitée selon la procédure décrite dans la politique de confidentialité.
        </p>
        <p>
          Le traitement n'est pas nécessairement instantané et peut nécessiter une vérification.
          Certaines contributions publiques (messages de forum, avis) peuvent être conservées de manière
          anonymisée selon la politique confirmée.
        </p>
      </section>

      <section>
        <h2>5. Contenus des utilisateurs</h2>
        <p>
          Les avis, commentaires, messages, playlists, contributions au forum, messages de chat, avatars
          et biographies restent sous la responsabilité de leur auteur. Chaque utilisateur garantit
          disposer des droits nécessaires sur les contenus qu'il publie et s'engage à ne rien publier
          d'illicite.
        </p>
        <p>
          Pour permettre l'affichage et l'hébergement technique de ces contenus dans le cadre du service,
          l'utilisateur concède à KAZEN une licence limitée, non exclusive, gratuite et strictement
          nécessaire à l'exploitation du service (affichage, sauvegarde, indexation interne). Cette
          licence prend fin en cas de retrait du contenu, sous réserve des obligations légales de
          conservation.
        </p>
        <p>
          KAZEN peut modérer les contenus selon les{" "}
          <a href="/regles-communautaires">règles communautaires</a>.
        </p>
      </section>

      <section>
        <h2>6. Comportements interdits</h2>
        <ul>
          <li>Harcèlement, menaces, incitation à la haine ou à la violence.</li>
          <li>Contenu sexuel illicite ; toute forme d'exploitation ou de sexualisation de mineurs.</li>
          <li>Spam, fraude, phishing, usurpation d'identité, diffusion de logiciels malveillants.</li>
          <li>Collecte non autorisée de données d'autres utilisateurs.</li>
          <li>Contournement des mesures de sécurité, automatisation abusive, scraping massif.</li>
          <li>Atteinte aux droits de tiers (propriété intellectuelle, vie privée, image).</li>
          <li>Diffusion de données personnelles sans consentement (doxxing).</li>
          <li>Partage de liens manifestement illicites.</li>
        </ul>
      </section>

      <section>
        <h2>7. Modération</h2>
        <p>
          KAZEN dispose des outils suivants : signalement de contenu, suppression, suspension, bannissement
          et rôles de modération. Une console interne (Founder Console) permet la supervision des
          signalements et des actions de modération.
        </p>
        <p>
          KAZEN n'exerce pas un contrôle préalable de tous les contenus. Les décisions peuvent dépendre du
          contexte, de la gravité et de l'historique. Aucun délai précis de traitement n'est garanti à ce
          stade.
        </p>
      </section>

      <section>
        <h2>8. Assistant IA</h2>
        <p>
          L'assistant IA de KAZEN est un système automatisé. Ses réponses peuvent contenir des erreurs
          ou des approximations et ne constituent en aucun cas un conseil professionnel. L'utilisateur
          est invité à vérifier les informations importantes. L'usage est encadré par des quotas
          quotidiens et une politique de cache décrite dans la politique de confidentialité.
        </p>
      </section>

      <section>
        <h2>9. Imports</h2>
        <p>
          L'utilisateur reste responsable des fichiers ou données qu'il importe. KAZEN ne garantit ni la
          complétude, ni l'exactitude, ni la disponibilité des données externes. Les imports peuvent être
          partiellement rejetés en cas de format invalide, de dépassement des limites ou de contenus
          illicites.
        </p>
      </section>

      <section>
        <h2>10. Disponibilité et fonctionnalités bêta</h2>
        <p>
          Certaines fonctionnalités sont proposées en bêta et peuvent évoluer, être modifiées ou
          retirées sans préavis. Aucune garantie absolue de disponibilité n'est fournie.
        </p>
      </section>

      <section>
        <h2>11. Premium Bêta</h2>
        <p>
          L'accès Premium est actuellement offert à tous les membres dans le cadre de la bêta et
          n'implique aucune facturation à ce jour. Il ne confère aucun droit acquis à une future offre
          payante : toute évolution tarifaire fera l'objet d'une information préalable et d'un
          consentement explicite avant tout prélèvement éventuel.
        </p>
      </section>

      <section>
        <h2>12. Responsabilité</h2>
        <p>
          KAZEN s'efforce d'offrir un service fiable, mais ne peut être tenu responsable des interruptions,
          des pertes de données résultant de circonstances hors de son contrôle raisonnable, ni des
          contenus publiés par les utilisateurs. Les dispositions légales impératives ne sont pas exclues.
        </p>
      </section>

      <section>
        <h2>13. Résiliation</h2>
        <p>
          L'utilisateur peut demander la suppression de son compte à tout moment. KAZEN peut suspendre ou
          résilier l'accès en cas de violation des présentes conditions ou des règles communautaires,
          selon la gravité constatée. Certaines données peuvent être conservées à des fins légales,
          probatoires ou de sécurité.
        </p>
      </section>

      <section>
        <h2>14. Droit applicable</h2>
        <p>
          Droit applicable : {LEGAL.governingLaw}. Juridiction compétente : {LEGAL.jurisdiction}.
        </p>
        <p>
          Ces informations dépendent de la confirmation du siège de l'éditeur et seront finalisées avec
          l'avocat référent.
        </p>
      </section>
    </LegalPageLayout>
  );
}
