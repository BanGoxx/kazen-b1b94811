import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const Route = createFileRoute("/regles-communautaires")({
  head: () => ({
    meta: [
      { title: "Règles communautaires (brouillon) — KAZEN" },
      { name: "description", content: "Règles de la communauté KAZEN — brouillon en cours de finalisation." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ReglesPage,
});

function ReglesPage() {
  return (
    <LegalPageLayout
      title="Règles communautaires"
      subtitle="Ce qui est attendu — et ce qui ne l'est pas — dans les espaces communautaires de KAZEN."
    >
      <section>
        <h2>1. Principes</h2>
        <ul>
          <li>Respect et bonne foi envers les autres membres.</li>
          <li>Discussion constructive, même en cas de désaccord.</li>
          <li>Protection des personnes et de leur vie privée.</li>
          <li>Respect des droits d'auteur et des créateurs.</li>
        </ul>
      </section>

      <section>
        <h2>2. Comportements interdits</h2>
        <ul>
          <li>Harcèlement, intimidation, menaces, incitation à la violence.</li>
          <li>Discours de haine, discrimination fondée notamment sur l'origine, la religion, le genre, l'orientation sexuelle, le handicap.</li>
          <li>Contenu sexuel illicite ; toute forme d'exploitation ou de sexualisation de mineurs — signalement immédiat aux autorités compétentes.</li>
          <li>Doxxing et diffusion d'informations privées sans consentement.</li>
          <li>Spam, arnaques, phishing, diffusion de logiciels malveillants.</li>
          <li>Usurpation d'identité, multi-comptes abusifs, contournement de sanctions.</li>
          <li>Piratage, liens manifestement illicites, partage non autorisé d'œuvres.</li>
          <li>Publicité non autorisée, manipulation des votes ou des avis.</li>
          <li>Signalements manifestement abusifs ou de mauvaise foi.</li>
        </ul>
      </section>

      <section>
        <h2>3. Spoilers</h2>
        <p>
          Merci d'éviter les spoilers volontaires dans les titres, les résumés et les espaces non
          dédiés. Un espace de discussion peut préciser sa propre tolérance aux spoilers. En cas de
          doute, protégez le plaisir des autres membres.
        </p>
      </section>

      <section>
        <h2>4. Signalement</h2>
        <p>
          Chaque contenu communautaire (forum, chat, avis, playlist) peut être signalé via les outils
          intégrés. Un signalement doit préciser autant que possible la nature du problème. Les
          signalements sont examinés par l'équipe de modération. Aucun délai de réponse immédiat n'est
          garanti. Les signalements abusifs peuvent donner lieu à des sanctions.
        </p>
      </section>

      <section>
        <h2>5. Sanctions</h2>
        <p>
          L'équipe de modération peut, selon la gravité et le contexte : avertir, supprimer un contenu,
          restreindre certaines actions, suspendre temporairement ou bannir un compte. La progressivité
          n'est pas systématique pour les cas graves (menaces, contenus impliquant des mineurs,
          incitation à la haine, etc.).
        </p>
      </section>

      <section>
        <h2>6. Protection des mineurs</h2>
        <p>
          Dans tous les espaces communautaires :
        </p>
        <ul>
          <li>Ne demandez pas d'informations personnelles à un autre membre.</li>
          <li>N'organisez pas de rencontres à risque.</li>
          <li>Ne publiez pas de contenu à caractère sexuel.</li>
          <li>Signalez immédiatement tout comportement inquiétant ou toute prise de contact suspecte.</li>
        </ul>
      </section>

      <section>
        <h2>7. Fonctionnement de la modération</h2>
        <p>
          La modération peut intervenir après signalement ou détection. KAZEN n'exerce pas un contrôle
          préalable de tous les contenus. Les décisions dépendent du contexte, de la gravité et de
          l'historique du compte concerné. Les mesures visent la sécurité et la qualité des
          échanges — pas la censure des opinions légitimes.
        </p>
      </section>

      <section>
        <h2>8. Lien avec les autres documents</h2>
        <p>
          Ces règles complètent les <a href="/cgu">conditions générales d'utilisation</a> et
          s'appliquent en particulier au forum, au chat privé, au chat live communautaire, aux avis,
          commentaires et playlists partagées.
        </p>
      </section>
    </LegalPageLayout>
  );
}
