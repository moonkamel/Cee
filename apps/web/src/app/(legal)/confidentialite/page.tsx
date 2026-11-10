import { EDITOR, UPDATED } from '@/lib/legal/info';

export const metadata = { title: 'Confidentialité · Preuvio' };

// Modèle à faire relire par un juriste avant le lancement commercial (section 16).
export default function Privacy() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Politique de confidentialité</h1>
      <p className="text-text-muted">Mise à jour : {UPDATED}</p>

      <h2 className="text-2xl font-bold">Qui est responsable de vos données ?</h2>
      <ul className="list-disc pl-6">
        <li>
          <b>Comptes utilisateurs et facturation</b> : {EDITOR.name} est responsable de traitement.
        </li>
        <li>
          <b>Chantiers, photos, clients finaux, PV</b> : l’entreprise qui utilise Preuvio est
          responsable de traitement ; {EDITOR.name} agit pour son compte, comme sous-traitant
          (article 28 du RGPD), selon l’accord annexé aux <a href="/cgu">conditions générales</a>.
        </li>
      </ul>

      <h2 className="text-2xl font-bold">Quelles données, pourquoi, combien de temps</h2>
      <ul className="list-disc pl-6">
        <li>
          <b>Compte</b> (nom, portable, e-mail, rôle) : accès au service, pendant toute la durée du
          contrat puis 3 ans.
        </li>
        <li>
          <b>Photos de chantier</b> (date, heure, position GPS au moment de la photo, empreinte) :
          preuve des travaux. Conservées selon la durée réglée par l’entreprise, 10 ans par défaut,
          alignés sur la garantie décennale.
        </li>
        <li>
          <b>Clients finaux</b> (nom, adresse du chantier, téléphone, e-mail) et <b>PV signé</b>{' '}
          (nom, date, adresse IP, navigateur) : suivi du chantier et preuve de la réception.
        </li>
        <li>
          <b>Notes vocales</b> : transcrites puis conservées avec le chantier.
        </li>
        <li>
          <b>Facturation</b> : 10 ans (obligation comptable).
        </li>
        <li>
          <b>Mesure d’usage et plantages</b> : identifiant pseudonyme, sans enregistrement de
          session ; 12 mois au plus.
        </li>
      </ul>

      <h2 className="text-2xl font-bold">Minimisation</h2>
      <ul className="list-disc pl-6">
        <li>L’application ne demande jamais de photographier des personnes.</li>
        <li>La position est relevée uniquement au moment d’une photo, jamais en continu.</li>
        <li>L’intelligence artificielle ne reçoit ni le nom ni les coordonnées du client.</li>
        <li>
          Visages, plaques d’immatriculation et numéros de rue sont floutés sur les contenus
          marketing, créés seulement avec l’accord du client au PV.
        </li>
      </ul>

      <h2 className="text-2xl font-bold">Où sont les données</h2>
      <p>
        Les données sont hébergées dans l’Union européenne. Certains prestataires sont des sociétés
        américaines : les transferts sont encadrés par des clauses contractuelles types. Voir la{' '}
        <a href="/sous-traitants">liste des sous-traitants</a>.
      </p>

      <h2 className="text-2xl font-bold">Sécurité</h2>
      <p>
        Chiffrement en transit et au repos, stockage privé accessible par liens temporaires de 5
        minutes, cloisonnement strict entre entreprises, journal d’audit en ajout seul, sauvegardes
        quotidiennes.
      </p>

      <h2 className="text-2xl font-bold">Vos droits</h2>
      <p>
        Accès, rectification, effacement, limitation, opposition et portabilité. Client final :
        adressez-vous à l’entreprise qui a réalisé vos travaux ; elle traite la demande depuis
        Preuvio. Quand une obligation de conservation s’applique (preuve des travaux), les données
        sont conservées mais leur accès est restreint. Utilisateur : écrivez à {EDITOR.dpo}. Vous
        pouvez aussi saisir la CNIL (cnil.fr).
      </p>
    </>
  );
}
