'use client';

import { MAX_REQUEST_WORDS } from '@preuvio/shared';
import { useActionState } from 'react';
import { decide, type FormState } from '@/app/actions';

type Props = {
  slotId: string;
  jobsiteId: string;
  recipients: { id: string; name: string }[];
  aiMessage: string | null;
};

/** « Valider » ou « Demander une reprise » (message de 8 mots, prérempli par celui de l'IA). */
export function DecisionForm({ slotId, jobsiteId, recipients, aiMessage }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(decide, null);
  if (state?.ok)
    return (
      <p role="status" className="text-lg font-bold text-ok">
        Décision enregistrée.
      </p>
    );
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="jobsiteId" value={jobsiteId} />
      <input type="hidden" name="aiMessage" value={aiMessage ?? ''} />
      <button
        name="choice"
        value="validate"
        disabled={pending}
        className="min-h-14 rounded-xl border-2 border-ok bg-surface px-4 text-lg font-bold text-ok"
      >
        Valider la photo
      </button>
      <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-lg font-bold">Demander une reprise</legend>
        <label className="flex flex-col gap-1">
          <span className="text-base text-text-muted">Poseur</span>
          <select
            name="recipientId"
            defaultValue={recipients[0]?.id}
            className="min-h-12 rounded-xl border-2 border-brand bg-surface px-3"
          >
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base text-text-muted">
            Message ({MAX_REQUEST_WORDS} mots maximum)
          </span>
          <input
            name="message"
            defaultValue={aiMessage ?? ''}
            className="min-h-12 rounded-xl border-2 border-brand bg-surface px-3"
          />
        </label>
        <button
          name="choice"
          value="retake"
          disabled={pending || recipients.length === 0}
          className="min-h-14 rounded-xl bg-action px-4 text-lg font-bold text-on-action"
        >
          Demander au poseur
        </button>
      </fieldset>
      {state?.error ? (
        <p role="alert" className="font-bold text-ko">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
