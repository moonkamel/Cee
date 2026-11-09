import {
  batchStatus,
  fitsBatch,
  formatParis,
  permissions,
  priorityCorrections,
} from '@preuvio/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { addToBatch, markCorrected, removeFromBatch } from '@/app/batches-actions';
import { CorrectionForm, ImportBatchForm, InspectionForm } from '@/components/BatchForms';
import { type BatchJobsite, currentThreshold, loadBatch } from '@/lib/batches';
import { currentUser } from '@/lib/dal';

const RESULT = {
  satisfactory: { word: 'Satisfaisant', cls: 'text-ok' },
  unsatisfactory: { word: 'Non satisfaisant', cls: 'text-ko' },
  unverifiable: { word: 'Non vérifiable', cls: 'text-warn' },
} as const;
const pct = (n: number) => `${Math.round(n * 1000) / 10} %`;
const day = (d: string) => formatParis(`${d}T12:00:00Z`, false);
const label = (j: BatchJobsite) => j.reference ?? j.address;

async function Batch({ params }: { params: PageProps<'/lots/[id]'>['params'] }) {
  const { id } = await params;
  const [user, loaded, threshold] = await Promise.all([
    currentUser(),
    loadBatch(id),
    currentThreshold(),
  ]);
  if (!loaded) notFound();
  const { batch, jobsites, others, inspections } = loaded;
  const can = permissions(user.role).export;
  const s = batchStatus(
    inspections.map((i) => i.result),
    threshold,
  );
  const byId = new Map([...jobsites, ...others].map((j) => [j.id, j]));
  const priority = priorityCorrections(inspections);
  const fitting = others
    .map((j) => ({
      j,
      fit: fitsBatch(
        { operationCodes: j.jobsite_operations.map((o) => o.code), date: j.planned_end },
        { operationCode: batch.operation_code, start: batch.period_start, end: batch.period_end },
      ),
    }))
    .filter((x) => x.fit.ok);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/lots">← Lots CEE</Link>
        <h1 className="text-[32px] font-bold">
          {batch.operation_code}
          {batch.delegataires ? ` · ${batch.delegataires.name}` : ''}
        </h1>
        <p className="text-lg">
          {s.done} contrôle(s) · taux observé <strong>{pct(s.rate)}</strong> · seuil{' '}
          {pct(threshold)}
          {s.over ? <strong className="text-ko"> · seuil dépassé</strong> : null}
          {!s.over && s.near ? <strong className="text-warn"> · proche du seuil</strong> : null}
        </p>
        {s.failuresBeforeOver !== null && !s.over ? (
          <p className="text-text-muted">
            Si {s.failuresBeforeOver} chantier(s) de plus sont jugés non satisfaisants, ce lot
            dépasse le seuil.
          </p>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">À corriger en priorité</h2>
        {priority.length === 0 ? <p className="text-text-muted">Rien à corriger.</p> : null}
        <ul className="flex flex-col gap-3">
          {priority.map((i) => {
            const j = byId.get(i.jobsite_id);
            return (
              <li
                key={i.id}
                className="flex flex-col gap-2 rounded-xl border-2 border-ko bg-surface p-4"
              >
                <span>
                  <Link href={`/chantiers/${i.jobsite_id}`} className="font-bold">
                    {j ? label(j) : 'Chantier'}
                  </Link>{' '}
                  · contrôlé le {day(i.inspected_on)}
                  {i.correction_planned_at
                    ? ` · reprise planifiée le ${formatParis(i.correction_planned_at)}`
                    : ''}
                </span>
                {i.findings ? <span>Constats : {i.findings}</span> : null}
                {can && j ? (
                  <div className="flex flex-col gap-2">
                    <CorrectionForm
                      batchId={batch.id}
                      inspectionId={i.id}
                      slots={j.proof_slots
                        .filter((p) => p.applicable)
                        .map((p) => ({ id: p.id, instruction: p.instruction }))}
                    />
                    <form action={markCorrected}>
                      <input type="hidden" name="inspectionId" value={i.id} />
                      <input type="hidden" name="batchId" value={batch.id} />
                      <button className="min-h-10 rounded-lg border border-border px-3">
                        Marquer corrigé aujourd’hui
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Contrôles</h2>
        {can ? (
          <InspectionForm
            batchId={batch.id}
            jobsites={jobsites.map((j) => ({ id: j.id, label: label(j) }))}
          />
        ) : null}
        <ul className="flex flex-col gap-2">
          {inspections.map((i) => (
            <li key={i.id}>
              {day(i.inspected_on)} ·{' '}
              {byId.get(i.jobsite_id) ? label(byId.get(i.jobsite_id)!) : 'Chantier'} ·{' '}
              <strong className={RESULT[i.result].cls}>{RESULT[i.result].word}</strong>
              {i.body ? ` · ${i.body}` : ''}
              {i.corrected_on ? ` · corrigé le ${day(i.corrected_on)}` : ''}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Chantiers du lot ({jobsites.length})</h2>
        <ul className="flex flex-col gap-1">
          {jobsites.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center gap-3">
              <Link href={`/chantiers/${j.id}`}>{label(j)}</Link>
              {can ? (
                <form action={removeFromBatch}>
                  <input type="hidden" name="batchId" value={batch.id} />
                  <input type="hidden" name="jobsiteId" value={j.id} />
                  <button className="min-h-10 rounded-lg border border-border px-3">Retirer</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {can ? (
          <>
            <ImportBatchForm batchId={batch.id} />
            {fitting.length ? (
              <form action={addToBatch} className="flex flex-col gap-2">
                <input type="hidden" name="batchId" value={batch.id} />
                <span className="font-bold">Chantiers qui correspondent (fiche et période)</span>
                {fitting.map(({ j }) => (
                  <label key={j.id} className="flex min-h-10 items-center gap-2">
                    <input type="checkbox" name="jobsiteId" value={j.id} className="h-6 w-6" />
                    {label(j)} · {j.address}
                  </label>
                ))}
                <button className="min-h-12 self-start rounded-xl border-2 border-brand px-4 font-bold text-brand">
                  Ajouter au lot
                </button>
              </form>
            ) : null}
          </>
        ) : null}
      </section>
    </>
  );
}

export default function BatchPage(props: PageProps<'/lots/[id]'>) {
  return (
    <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
      <Batch params={props.params} />
    </Suspense>
  );
}
