import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LEGAL } from "@/lib/legal-config";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales (brouillon) — KAZEN" },
      { name: "description", content: "Mentions légales de KAZEN — document interne en cours de finalisation." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MentionsLegalesPage,
});

function MentionsLegalesPage() {
  return (
    <LegalPageLayout
      title="Mentions légales"
      subtitle="Informations relatives à l'éditeur et à l'hébergeur de KAZEN, conformément à la loi n° 2004-575 (LCEN)."
    >
      <section>
        <h2>1. Éditeur</h2>
        <ul>
          <li><strong>Nom / dénomination :</strong> {LEGAL.publisherName}</li>
          <li><strong>Statut juridique :</strong> {LEGAL.publisherStatus}</li>
          <li><strong>Adresse :</strong> {LEGAL.publisherAddress}</li>
          <li><strong>Contact :</strong> {LEGAL.publisherEmail}</li>
          <li><strong>Immatriculation :</strong> {LEGAL.publisherRegistration}</li>
        </ul>
      </section>

      <section>
        <h2>2. Directeur de la publication</h2>
        <p>{LEGAL.publicationDirector}</p>
      </section>

      <section>
        <h2>3. Hébergement</h2>
        <p>
          KAZEN repose techniquement sur les infrastructures de ses fournisseurs :
        </p>
        <ul>
          <li><strong>Fournisseur(s) technique(s) :</strong> {LEGAL.hostName}</li>
          <li><strong>Adresse contractuelle :</strong> {LEGAL.hostAddress}</li>
          <li><strong>Contact :</strong> {LEGAL.hostContact}</li>
        </ul>
        <p>
          Les entités contractuelles précises et leurs coordonnées seront confirmées avant la finalisation
          de ce document.
        </p>
      </section>

      <section>
        <h2>4. Contact et signalement (LCEN)</h2>
        <p>
          Toute demande relative à un contenu potentiellement illicite hébergé sur KAZEN
          (article 6 de la LCEN) peut être adressée à :
        </p>
        <ul>
          <li><strong>Contact LCEN :</strong> {LEGAL.lcenContact}</li>
        </ul>
        <p>
          Une demande de retrait doit préciser les éléments d'identification du contenu, le motif
          invoqué, et les coordonnées du demandeur. L'envoi d'un signalement n'implique pas un retrait
          automatique : chaque demande est examinée selon la procédure de modération applicable.
        </p>
      </section>

      <section>
        <h2>5. Propriété intellectuelle</h2>
        <p>
          La marque « KAZEN », l'interface, la charte graphique, les textes originaux et le code
          applicatif du service sont la propriété de l'éditeur ou de ses ayants droit.
        </p>
        <p>
          KAZEN affiche par ailleurs des métadonnées, affiches, résumés et éléments visuels provenant
          de services tiers (notamment AniList et TMDB). Les marques, titres, images et contenus
          associés à des œuvres audiovisuelles restent la propriété exclusive de leurs titulaires
          respectifs. Leur affichage sur KAZEN à des fins de découverte et de suivi n'implique aucune
          affiliation, partenariat ni parrainage, sauf mention expresse et vérifiable.
        </p>
        <p>
          Une politique d'attribution et de retrait détaillée est en cours de finalisation
          (phase 26.5 — matrice licences).
        </p>
      </section>

      <section>
        <h2>6. Nature du service</h2>
        <p>
          KAZEN est un service de <strong>découverte</strong> et de <strong>suivi (tracking) personnel</strong>
          d'anime, séries et films. KAZEN n'héberge pas les œuvres audiovisuelles elles-mêmes et ne les
          diffuse pas en streaming. Les liens éventuels vers des plateformes tierces sont fournis à titre
          d'information et ne constituent pas une affiliation.
        </p>
      </section>

      <section>
        <h2>7. Données personnelles et cookies</h2>
        <p>
          Le traitement des données personnelles est décrit dans la{" "}
          <a href="/confidentialite">politique de confidentialité</a>. La gestion des cookies et
          traceurs fera l'objet d'une interface dédiée (phase 26.3).
        </p>
      </section>
    </LegalPageLayout>
  );
}
