import { batchStatus } from '@preuvio/shared';
import { Suspense } from 'react';
import { loadDashboard } from '@/lib/queries';

export const metadata = { title: 'Lots CEE · Preuvio' };

async function Batches() {
  const data = await loadDashboard();
  if (data.batches.length === 0) {
    return (
      <p className="text-text-muted">
        Aucun lot ouvert. Le suivi des lots arrive avec les exports (S14-S15).
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {data.batches.map((b) => {
        const s = batchStatus(
          b.inspections.map((i) => i.result),
          data.threshold,
        );
        return (
          <li
            key={b.id}
            className={`flex flex-col gap-1 rounded-xl bg-surface p-4 ${s.near ? 'border-2 border-ko' : 'border border-border'}`}
          >
            <span className="text-lg font-bold">{b.operation_code}</span>
            <span>
              {s.done} contrôle(s) · taux observé {Math.round(s.rate * 1000) / 10} % · seuil{' '}
              {Math.round(data.threshold * 1000) / 10} %
            </span>
            {s.failuresBeforeOver !== null ? (
              <span className={s.near ? 'font-bold text-ko' : 'text-text-muted'}>
                {s.over
                  ? 'Seuil dépassé'
                  : `Si ${s.failuresBeforeOver} chantier(s) de plus sont non satisfaisants, ce lot dépasse le seuil.`}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function BatchesPage() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Lots CEE</h1>
      <p className="text-base text-text-muted">
        Indicateur interne : il ne remplace ni le contrôle officiel ni le calcul du délégataire.
      </p>
      <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
        <Batches />
      </Suspense>
    </>
  );
}
