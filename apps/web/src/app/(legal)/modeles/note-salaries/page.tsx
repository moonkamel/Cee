export const metadata = { title: 'Modèle : note aux salariés · Preuvio' };

// Modèle fourni au dirigeant (section 16) : géolocalisation au moment des photos seulement.
export default function EmployeeNotice() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Modèle : note d’information des salariés</h1>
      <p className="text-text-muted">
        À adapter, puis à remettre à chaque salarié qui utilise Preuvio (affichage ou remise en main
        propre). Les passages entre crochets sont à compléter.
      </p>
      <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-2xl font-bold">Utilisation de l’application Preuvio</h2>
        <p>
          [Nom de l’entreprise] utilise l’application Preuvio pour documenter les chantiers de
          rénovation énergétique et constituer les dossiers de primes CEE.
        </p>
        <p>
          <b>Données vous concernant</b> : nom, numéro de portable professionnel, rôle, et pour
          chaque photo prise : date, heure, position GPS au moment de la photo, et votre nom en tant
          qu’auteur. Vos notes vocales sont transcrites.
        </p>
        <p>
          <b>Pas de suivi en continu</b> : la position n’est relevée qu’au moment où vous prenez une
          photo de chantier. L’application ne suit jamais vos déplacements.
        </p>
        <p>
          <b>Finalités</b> : preuve des travaux réalisés auprès des délégataires CEE, des clients et
          en cas de litige ; organisation des chantiers. Les indicateurs par poseur servent à
          accompagner, non à sanctionner.
        </p>
        <p>
          <b>Base légale</b> : intérêt légitime de l’entreprise à prouver la bonne réalisation des
          travaux et respect de ses obligations liées aux CEE.
        </p>
        <p>
          <b>Conservation</b> : [10] ans pour les photos de chantier ; votre compte est désactivé à
          votre départ, vos photos restent dans les dossiers de l’entreprise.
        </p>
        <p>
          <b>Destinataires</b> : la direction et le bureau de [Nom de l’entreprise], le délégataire
          CEE et le client du chantier concerné ; Preuvio et ses sous-traitants techniques.
        </p>
        <p>
          <b>Vos droits</b> : accès, rectification, opposition, auprès de [contact]. Vous pouvez
          saisir la CNIL.
        </p>
      </article>
    </>
  );
}
