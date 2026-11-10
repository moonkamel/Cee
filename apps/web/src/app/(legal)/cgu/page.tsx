import { EDITOR, UPDATED } from '@/lib/legal/info';

export const metadata = { title: 'Conditions générales · Preuvio' };

// Modèle à faire relire par un juriste avant le lancement commercial (sections 15 et 16).
export default function Terms() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Conditions générales d’utilisation et de vente</h1>
      <p className="text-text-muted">Mise à jour : {UPDATED}</p>

      <h2 className="text-2xl font-bold">1. Le service</h2>
      <p>
        {EDITOR.name} fournit aux entreprises de rénovation énergétique une application de preuve de
        pose : photos guidées et scellées, pré-contrôle par intelligence artificielle, rapports,
        page client et PV de réception, exports pour les délégataires CEE.
      </p>

      <h2 className="text-2xl font-bold">
        2. Ce que Preuvio garantit, et ce qu’il ne garantit pas
      </h2>
      <p>
        Preuvio fournit des éléments de preuve : photos horodatées et géolocalisées, empreintes,
        journal d’audit. Il ne garantit pas leur acceptation par un délégataire, un contrôleur ou un
        juge, ni l’obtention d’une prime. Le pré-contrôle par IA signale des doutes ; il ne valide
        jamais la conformité réglementaire d’un chantier.
      </p>

      <h2 className="text-2xl font-bold">3. Essai, offres et paiement</h2>
      <p>
        Essai gratuit de 30 jours ou 10 chantiers, sans carte bancaire. Offres Solo, Équipe et
        Entreprise, mensuelles ou annuelles, prix hors taxes affichés sur la page Abonnement.
        Paiement par carte ou prélèvement SEPA via Stripe ; factures avec TVA.
      </p>

      <h2 className="text-2xl font-bold">4. Résiliation et réversibilité</h2>
      <p>
        Résiliation à tout moment depuis la page Abonnement, effective à la fin de la période payée.
        L’entreprise peut exporter toutes ses données (photos originales, PDF, CSV) à tout moment.
        Après l’essai ou la résiliation, les données restent consultables 90 jours, puis l’accès est
        fermé ; elles sont ensuite supprimées à l’issue de la durée de conservation choisie.
      </p>

      <h2 className="text-2xl font-bold">5. Obligations de l’entreprise</h2>
      <p>
        Informer ses salariés et ses clients (modèles fournis :{' '}
        <a href="/modeles/note-salaries">note d’information des salariés</a>,{' '}
        <a href="/modeles/mention-client">mention pour les clients</a>), utiliser des comptes
        nominatifs, ne pas photographier de personnes.
      </p>

      <h2 className="text-2xl font-bold">Annexe : accord de sous-traitance (article 28 du RGPD)</h2>
      <ul className="list-disc pl-6">
        <li>
          <b>Objet</b> : hébergement et traitement des données des chantiers, des salariés et des
          clients finaux de l’entreprise, pour la durée du contrat.
        </li>
        <li>
          <b>Instructions</b> : {EDITOR.name} ne traite les données que sur instruction de
          l’entreprise, pour fournir le service.
        </li>
        <li>
          <b>Confidentialité</b> : les personnes autorisées sont soumises au secret.
        </li>
        <li>
          <b>Sécurité</b> : mesures décrites dans la{' '}
          <a href="/confidentialite">politique de confidentialité</a>.
        </li>
        <li>
          <b>Sous-traitants ultérieurs</b> : autorisés selon la{' '}
          <a href="/sous-traitants">liste publique</a> ; tout changement est annoncé 30 jours à
          l’avance.
        </li>
        <li>
          <b>Assistance</b> : outils d’exercice des droits (export, effacement) fournis dans
          l’application ; aide sur demande.
        </li>
        <li>
          <b>Violation de données</b> : notification à l’entreprise dans les 48 heures après sa
          découverte.
        </li>
        <li>
          <b>Fin du contrat</b> : restitution par l’export complet, puis suppression à l’issue de la
          durée de conservation.
        </li>
        <li>
          <b>Audit</b> : informations nécessaires fournies sur demande.
        </li>
      </ul>
    </>
  );
}
