'use client';

import {
  DEFAULT_NAMING_PATTERN,
  DEFAULT_REQUIRED_DOCUMENTS,
  DOCUMENT_KINDS,
  DOCUMENT_LABELS,
  type DocumentKind,
  namePhotos,
  validatePattern,
} from '@preuvio/shared';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import type { FormState } from '@/app/actions';
import { addDocument, createExports, saveDelegataire, sendExportLink } from '@/app/exports-actions';

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
  if (state?.ok)
    return (
      <span role="status" className="font-bold text-ok">
        {ok}
      </span>
    );
  return null;
}

/** Lancement d'un export ; les cases des chantiers s'y rattachent par l'attribut « form ». */
export function CreateExportForm({ delegataireId }: { delegataireId: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createExports, null);
  return (
    <form id="export-form" action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="delegataireId" value={delegataireId ?? ''} />
      <button disabled={pending} className={primary}>
        Exporter les chantiers cochés
      </button>
      <span className="text-base text-text-muted">
        Un export avec des manques reste possible : il est marqué « incomplet ».
      </span>
      <Feedback state={state} ok="" />
    </form>
  );
}

type RunState = 'waiting' | 'running' | 'done' | 'failed';

/** Export groupé : les ZIP sont fabriqués l'un après l'autre, avec l'avancement à l'écran. */
export function ExportRunner({ items }: { items: { id: string; label: string }[] }) {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, { state: RunState; error?: string }>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const item of items) {
        if (cancelled) return;
        setStates((s) => ({ ...s, [item.id]: { state: 'running' } }));
        try {
          const res = await fetch(`/exports/${item.id}/zip`, { method: 'POST' });
          const body = (await res.json()) as { ok: boolean; error?: string };
          setStates((s) => ({
            ...s,
            [item.id]: body.ok ? { state: 'done' } : { state: 'failed', error: body.error },
          }));
        } catch {
          setStates((s) => ({ ...s, [item.id]: { state: 'failed', error: 'Réseau coupé' } }));
        }
      }
      if (!cancelled) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [items, router]);
  const word: Record<RunState, string> = {
    waiting: 'En attente',
    running: 'Fabrication du ZIP…',
    done: 'Prêt',
    failed: 'Échec',
  };
  return (
    <ul
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
      aria-live="polite"
    >
      {items.map((item) => {
        const s = states[item.id] ?? { state: 'waiting' as const };
        return (
          <li key={item.id} className="flex flex-wrap gap-3">
            <span className="font-bold">{item.label}</span>
            <span
              className={
                s.state === 'failed'
                  ? 'text-ko'
                  : s.state === 'done'
                    ? 'text-ok'
                    : 'text-text-muted'
              }
            >
              {word[s.state]}
              {s.error ? ` : ${s.error}` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Envoi du lien de téléchargement (7 jours) au délégataire par e-mail. */
export function SendLinkForm({ exportId }: { exportId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendExportLink, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="exportId" value={exportId} />
      <label className="sr-only" htmlFor={`email-${exportId}`}>
        E-mail du délégataire
      </label>
      <input
        id={`email-${exportId}`}
        name="email"
        type="email"
        required
        placeholder="depot@delegataire.fr"
        className={field}
      />
      <button disabled={pending} className={secondary}>
        Envoyer le lien
      </button>
      <Feedback state={state} ok="Lien envoyé" />
    </form>
  );
}

const SAMPLE = [
  { id: 'a', fiche: 'BAR-TH-171', phase: 'avant', takenAt: '2026-11-09T08:00:00Z' },
  { id: 'b', fiche: 'BAR-TH-171', phase: 'avant', takenAt: '2026-11-09T09:00:00Z' },
];

/** Délégataire : nom, règle de nommage (avec aperçu) et pièces exigées. */
export function DelegataireForm({
  delegataire,
}: {
  delegataire?: { id: string; name: string; naming_pattern: string; required: DocumentKind[] };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveDelegataire, null);
  const [pattern, setPattern] = useState(delegataire?.naming_pattern ?? DEFAULT_NAMING_PATTERN);
  const errors = validatePattern(pattern);
  const preview = errors.length
    ? null
    : [...namePhotos(pattern, { reference: 'CH-2026-001', client: 'Guérin' }, SAMPLE).values()];
  const required = delegataire?.required ?? DEFAULT_REQUIRED_DOCUMENTS;
  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      {delegataire ? <input type="hidden" name="id" value={delegataire.id} /> : null}
      <label className="flex flex-col gap-1">
        <span className="font-bold">Nom</span>
        <input name="name" required defaultValue={delegataire?.name} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">Nom des photos</span>
        <input
          name="pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          className={`${field} font-mono`}
        />
        <span className="text-base text-text-muted">
          Champs : {'{REF_CHANTIER} {FICHE} {ETAPE} {N} {CLIENT} {DATE}'}
        </span>
        {errors.length ? (
          <span role="alert" className="font-bold text-ko">
            {errors.join(' ; ')}
          </span>
        ) : (
          <span className="text-base">Exemple : {preview!.join(', ')}</span>
        )}
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-bold">Pièces exigées</legend>
        {DOCUMENT_KINDS.filter((k) => k !== 'autre').map((k) => (
          <label key={k} className="flex min-h-10 items-center gap-2">
            <input
              type="checkbox"
              name="required"
              value={k}
              defaultChecked={required.includes(k)}
              className="h-6 w-6"
            />
            {DOCUMENT_LABELS[k]}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || errors.length > 0} className={primary}>
          Enregistrer
        </button>
        <Feedback state={state} ok="Enregistré" />
      </div>
    </form>
  );
}

/** Ajout d'une pièce administrative au chantier. */
export function DocumentForm({ jobsiteId }: { jobsiteId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addDocument, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="jobsiteId" value={jobsiteId} />
      <label className="flex flex-col gap-1">
        <span className="text-base text-text-muted">Pièce</span>
        <select name="kind" className={field}>
          {DOCUMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {DOCUMENT_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base text-text-muted">Date du document</span>
        <input type="date" name="date" className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base text-text-muted">Fichier (PDF, JPEG, PNG)</span>
        <input
          type="file"
          name="file"
          required
          accept="application/pdf,image/jpeg,image/png"
          className="min-h-12"
        />
      </label>
      <button disabled={pending} className={secondary}>
        Ajouter
      </button>
      <Feedback state={state} ok="Pièce ajoutée" />
    </form>
  );
}
