'use client';

import { REPORT_SECTIONS, type ReportContent, SECTION_TITLES } from '@preuvio/shared';
import { useActionState } from 'react';
import { requestReport, saveReportVersion, type FormState } from '@/app/actions';

const primary =
  'min-h-12 rounded-xl bg-action px-4 text-lg font-bold text-on-action disabled:opacity-60';
const secondary =
  'min-h-12 rounded-xl border-2 border-brand bg-surface px-4 text-lg font-bold text-brand disabled:opacity-60';

/**
 * Demande de rapport. Pour un dossier de litige, les cases des photos du fil se rattachent à ce
 * formulaire par son identifiant (attribut « form »).
 */
export function RequestReportForm({
  jobsiteId,
  kind,
  label,
  formId,
}: {
  jobsiteId: string;
  kind: 'completion' | 'dispute';
  label: string;
  formId?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestReport, null);
  return (
    <form id={formId} action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="jobsiteId" value={jobsiteId} />
      <input type="hidden" name="kind" value={kind} />
      <button disabled={pending} className={kind === 'dispute' ? secondary : primary}>
        {label}
      </button>
      {state?.ok ? (
        <span role="status" className="font-bold text-ok">
          Demandé : le rapport arrive dans une minute environ.
        </span>
      ) : null}
      {state?.error ? (
        <span role="alert" className="font-bold text-ko">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

/** Relecture : chaque phrase se modifie ou se vide ; on peut en ajouter une par ligne. */
export function ReportEditor({
  reportId,
  content,
  refs,
}: {
  reportId: string;
  content: ReportContent;
  /** Libellé des justifications de chaque phrase (« photos 1, 2 · note 1 »). */
  refs: Record<string, string[]>;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveReportVersion, null);
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="reportId" value={reportId} />
      {REPORT_SECTIONS.map((key) => (
        <fieldset key={key} className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <legend className="px-1 text-xl font-bold">{SECTION_TITLES[key]}</legend>
          {content.sections[key].map((sentence, i) => (
            <label key={i} className="flex flex-col gap-1">
              <textarea
                name={`${key}.${i}`}
                defaultValue={sentence.text}
                rows={2}
                className="rounded-lg border border-border bg-surface p-3"
              />
              <span className="text-base text-text-muted">{refs[key]?.[i] ?? ''}</span>
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className="text-base text-text-muted">Ajouter (une phrase par ligne)</span>
            <textarea
              name={`${key}.new`}
              rows={2}
              className="rounded-lg border border-border bg-surface p-3"
            />
          </label>
        </fieldset>
      ))}
      <p className="text-base text-text-muted">
        Videz une phrase pour la retirer. L’enregistrement crée une nouvelle version ; celle-ci
        reste consultable.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={primary}>
          Enregistrer une nouvelle version
        </button>
        {state?.error ? (
          <span role="alert" className="font-bold text-ko">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
