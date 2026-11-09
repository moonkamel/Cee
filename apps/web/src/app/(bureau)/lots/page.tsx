import { batchStatus, formatParis, permissions } from '@preuvio/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { CreateBatchForm } from '@/components/BatchForms';
import { currentThreshold, loadBatches } from '@/lib/batches';
import { currentUser } from '@/lib/dal';
import { loadDelegataires } from '@/lib/exports/queries';

export const metadata = { title: 'Lots CEE · Preuvio' };

const LEVEL = {
  over: { word: 'Au-dessus du seuil', cls: 'border-2 border-ko', text: 'text-ko' },
  near: { word: 'Proche du seuil', cls: 'border-2 border-warn', text: 'text-warn' },
  normal: { word: 'Sous le seuil', cls: 'border border-border', text: 'text-ok' },
} as const;

const pct = (n: number) => `${Math.round(n * 1000) / 10} %`;

async function Batches() {
  const [user, batches, threshold, delegataires] = await Promise.all([
    currentUser(),
    loadBatches(),
    currentThreshold(),
    loadDelegataires(),
  ]);
  return (
    <>
      {permissions(user.role).export ? <CreateBatchForm delegataires={delegataires} /> : null}
      {batches.length === 0 ? <p className="text-text-muted">Aucun lot pour l’instant.</p> : null}
      <ul className="flex flex-col gap-3">
        {batches.map((b) => {
          const s = batchStatus(
            b.inspections.map((i) => i.result),
            threshold,
          );
          const level = LEVEL[s.over ? 'over' : s.near ? 'near' : 'normal'];
          return (
            <li key={b.id}>
              <Link
                href={`/lots/${b.id}`}
                className={`flex flex-col gap-1 rounded-xl bg-surface p-4 no-underline ${level.cls}`}
              >
                <span className="text-lg font-bold">
                  {b.operation_code}
                  {b.delegataires ? ` · ${b.delegataires.name}` : ''}
                </span>
                <span className="text-text-muted">
                  {b.period_start ? `du ${formatParis(`${b.period_start}T12:00:00Z`, false)}` : ''}
                  {b.period_end
                    ? ` au ${formatParis(`${b.period_end}T12:00:00Z`, false)}`
                    : ''} · {b.cee_batch_jobsites.length} chantier(s)
                </span>
                <span>
                  {s.done} contrôle(s) · taux observé {pct(s.rate)} · seuil {pct(threshold)} ·{' '}
                  <strong className={level.text}>{level.word}</strong>
                </span>
                {s.failuresBeforeOver !== null && !s.over ? (
                  <span className={s.near ? 'font-bold text-warn' : 'text-text-muted'}>
                    Si {s.failuresBeforeOver} chantier(s) de plus sont jugés non satisfaisants, ce
                    lot dépasse le seuil.
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
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
