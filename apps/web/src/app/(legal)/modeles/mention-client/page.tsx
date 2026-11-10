export const metadata = { title: 'Modèle : mention pour les clients · Preuvio' };

// Modèle de mention d'information des clients finaux (section 16), à intégrer au devis.
export default function ClientNotice() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Modèle : mention d’information des clients</h1>
      <p className="text-text-muted">
        À intégrer à vos devis ou conditions générales. Les passages entre crochets sont à
        compléter.
      </p>
      <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
        <p>
          Pendant les travaux, [Nom de l’entreprise] photographie le chantier (avant, pendant et
          après) pour prouver leur bonne réalisation, notamment auprès de l’organisme qui verse les
          primes CEE. Les photos sont datées et localisées ; elles ne visent jamais les personnes.
        </p>
        <p>
          Vos nom, adresse, téléphone et e-mail, les photos et le procès-verbal de réception sont
          conservés [10] ans, puis supprimés. Ils sont transmis au délégataire CEE et, le cas
          échéant, aux organismes de contrôle. Ils sont hébergés dans l’Union européenne par notre
          prestataire Preuvio.
        </p>
        <p>
          Vous recevez un lien personnel pour suivre vos travaux et signer le PV. Les photos de vos
          travaux ne sont utilisées pour notre communication qu’avec votre accord, sans adresse ni
          visage.
        </p>
        <p>
          Vous pouvez demander l’accès à vos données, leur rectification ou leur effacement auprès
          de [contact]. Lorsque la loi impose de conserver la preuve des travaux, vos données sont
          conservées mais leur accès est restreint. Vous pouvez saisir la CNIL.
        </p>
      </article>
    </>
  );
}
