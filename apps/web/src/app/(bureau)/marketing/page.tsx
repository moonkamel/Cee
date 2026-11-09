import { isTone, permissions } from '@preuvio/shared';
import { Suspense } from 'react';
import { MarketingReviewForm, MarketingShare } from '@/components/MarketingForms';
import { currentUser } from '@/lib/dal';
import { loadMarketingQueue, type MarketingRow } from '@/lib/marketing/queries';

// Recyclage marketing (section 13) : les contenus avant/après attendent ici le dirigeant ou
// l'admin. Rien n'est jamais publié automatiquement.

function Visuals({ row }: { row: MarketingRow }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- visuel privé, servi par la route */}
      <img
        src={`/marketing/${row.id}/square`}
        alt="Visuel carré avant/après"
        className="w-full max-w-sm rounded-lg border border-border"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- visuel privé, servi par la route */}
      <img
        src={`/marketing/${row.id}/story`}
        alt="Visuel vertical avant/après"
        className="w-40 rounded-lg border border-border"
      />
    </div>
  );
}

const title = (row: MarketingRow) =>
  `${row.jobsites?.reference ?? 'Chantier'}${row.city ? ` · ${row.city}` : ''}`;

async function Queue() {
  const user = await currentUser();
  if (!permissions(user.role).marketing) {
    return <p>Contenus réservés à l’admin et au dirigeant.</p>;
  }
  const { toReview, published } = await loadMarketingQueue();
  const company = user.companyName ?? 'realisation';
  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">À valider ({toReview.length})</h2>
        {toReview.length === 0 ? (
          <p className="text-text-muted">
            Rien à valider. Un contenu arrive quand un chantier est terminé, conforme, et que le
            client a coché la case photos au PV.
          </p>
        ) : null}
        {toReview.map((row) => (
          <article
            key={row.id}
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
          >
            <h3 className="text-xl font-bold">{title(row)}</h3>
            <Visuals row={row} />
            <p className="text-base text-text-muted">
              Vérifiez le floutage des visages, plaques et numéros de rue avant de publier.
            </p>
            <MarketingReviewForm
              id={row.id}
              captions={row.captions}
              tone={isTone(row.tone) ? row.tone : 'sobre'}
            />
          </article>
        ))}
      </section>
      {published.length ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Publiés</h2>
          {published.map((row) => (
            <article
              key={row.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <h3 className="text-xl font-bold">{title(row)}</h3>
              <Visuals row={row} />
              <p>{row.generated_text}</p>
              <MarketingShare id={row.id} company={company} caption={row.generated_text ?? ''} />
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}

export default function MarketingPage() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Marketing</h1>
      <p className="text-text-muted">
        Vos avant/après prêts à publier : partagez-les depuis votre téléphone.
      </p>
      <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
        <Queue />
      </Suspense>
    </>
  );
}
