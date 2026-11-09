'use client';

import { ALERT_KINDS, ALERTS, type AlertKind, canMute, type Role } from '@preuvio/shared';
import { useActionState } from 'react';
import type { FormState } from '@/app/actions';
import {
  addInspection,
  createBatch,
  importBatch,
  type ImportBatchState,
  planCorrection,
  saveAlertSettings,
} from '@/app/batches-actions';

const primary =
  'min-h-12 rounded-xl bg-action px-4 text-lg font-bold text-on-action disabled:opacity-60';
const secondary =
  'min-h-12 rounded-xl border-2 border-brand bg-surface px-4 font-bold text-brand disabled:opacity-60';
const field = 'min-h-12 rounded-lg border border-border bg-surface px-3';

function Feedback({ state, ok }: { state: FormState; ok: string }) {
  if (state?.error)
    return (
      <span role="alert" className="font-bold text-ko">
        {state.error}
      </span>
    );
  return state?.ok ? (
    <span role="status" className="font-bold text-ok">
      {ok}
    </span>
  ) : null;
}

export function CreateBatchForm({
  delegataires,
}: {
  delegataires: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBatch, null);
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <label className="flex flex-col gap-1">
        <span className="font-bold">Fiche</span>
        <input name="code" required placeholder="BAR-TH-171" className={`${field} font-mono`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">Délégataire</span>
        <select name="delegataireId" className={field}>
          <option value="">Aucun</option>
          {delegataires.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">Du</span>
        <input type="date" name="start" className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">Au</span>
        <input type="date" name="end" className={field} />
      </label>
      <button disabled={pending} className={primary}>
        Créer le lot
      </button>
      <Feedback state={state} ok="" />
    </form>
  );
}

export function ImportBatchForm({ batchId }: { batchId: string }) {
  const [state, action, pending] = useActionState<ImportBatchState, FormData>(importBatch, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="batchId" value={batchId} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-base text-text-muted">
            Fichier du délégataire (CSV, références de chantier ou de devis)
          </span>
          <input type="file" name="file" accept=".csv,text/csv" required className="min-h-12" />
        </label>
        <button disabled={pending} className={secondary}>
          Importer
        </button>
      </div>
      {state?.error ? (
        <span role="alert" className="font-bold text-ko">
          {state.error}
        </span>
      ) : null}
      {state?.added !== undefined ? (
        <span role="status">
          <strong className="text-ok">{state.added} chantier(s) ajouté(s)</strong>
          {state.missing?.length ? (
            <span className="text-ko"> · introuvable(s) : {state.missing.join(', ')}</span>
          ) : null}
        </span>
      ) : null}
    </form>
  );
}

export function InspectionForm({
  batchId,
  jobsites,
}: {
  batchId: string;
  jobsites: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addInspection, null);
  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <input type="hidden" name="batchId" value={batchId} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-bold">Chantier</span>
          <select name="jobsiteId" required className={field}>
            {jobsites.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">Type</span>
          <select name="kind" className={field}>
            <option value="on_site">Sur site</option>
            <option value="by_contact">Par contact</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">Date</span>
          <input type="date" name="date" required className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">Organisme</span>
          <input name="body" className={field} />
        </label>
      </div>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="font-bold">Résultat</legend>
        {[
          ['satisfactory', 'Satisfaisant'],
          ['unsatisfactory', 'Non satisfaisant'],
          ['unverifiable', 'Non vérifiable'],
        ].map(([v, l]) => (
          <label key={v} className="flex min-h-10 items-center gap-2">
            <input type="radio" name="result" value={v} required className="h-6 w-6" />
            {l}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="font-bold">Constats</span>
        <textarea
          name="findings"
          rows={2}
          className="rounded-lg border border-border bg-surface p-3"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || jobsites.length === 0} className={primary}>
          Enregistrer le contrôle
        </button>
        <Feedback state={state} ok="Contrôle enregistré" />
      </div>
    </form>
  );
}

/** « Planifier la reprise » : le bureau coche les preuves concernées par les constats. */
export function CorrectionForm({
  batchId,
  inspectionId,
  slots,
}: {
  batchId: string;
  inspectionId: string;
  slots: { id: string; instruction: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(planCorrection, null);
  if (state?.ok)
    return (
      <p role="status" className="font-bold text-ok">
        Reprise planifiée : le poseur est prévenu.
      </p>
    );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="inspectionId" value={inspectionId} />
      <details>
        <summary className="min-h-10 cursor-pointer font-bold text-brand">
          Planifier la reprise
        </summary>
        <div className="flex flex-col gap-1 pt-2">
          {slots.map((s) => (
            <label key={s.id} className="flex min-h-10 items-center gap-2">
              <input type="checkbox" name="slotId" value={s.id} className="h-6 w-6" />
              {s.instruction}
            </label>
          ))}
          <button disabled={pending} className={`${secondary} self-start`}>
            Créer les preuves « après correction »
          </button>
          <Feedback state={state} ok="" />
        </div>
      </details>
    </form>
  );
}

export function AlertSettingsForm({
  role,
  email,
  muted,
}: {
  role: Role;
  email: string | null;
  muted: string[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAlertSettings, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-bold">Adresse e-mail (facultative)</span>
        <input type="email" name="email" defaultValue={email ?? ''} className={field} />
        <span className="text-base text-text-muted">
          Sans adresse, les alertes prévues par e-mail arrivent en notification.
        </span>
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-bold">Alertes reçues</legend>
        {ALERT_KINDS.map((k: AlertKind) => {
          const locked = !canMute(k, role);
          return (
            <label key={k} className="flex min-h-10 items-center gap-2">
              {/* Case cochée : alerte reçue ; décochée : coupée. */}
              <input
                type="checkbox"
                name={locked ? undefined : 'kept'}
                value={k}
                defaultChecked={locked || !muted.includes(k)}
                disabled={locked}
                className="h-6 w-6"
              />
              {ALERTS[k].label}
              {locked ? (
                <span className="text-base text-text-muted">
                  {' '}
                  (toujours active pour le dirigeant)
                </span>
              ) : null}
            </label>
          );
        })}
      </fieldset>
      {ALERT_KINDS.filter((k) => canMute(k, role)).map((k) => (
        <input key={k} type="hidden" name="all" value={k} />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={primary}>
          Enregistrer
        </button>
        <Feedback state={state} ok="Réglages enregistrés" />
      </div>
    </form>
  );
}
