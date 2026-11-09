'use client';

import { useActionState, useState } from 'react';
import type { FormState } from '@/app/actions';
import { createClientLink, type LinkState, saveCompanySettings } from '@/app/client-actions';

const field = 'min-h-12 rounded-lg border border-border bg-surface px-3';
const primary =
  'min-h-12 rounded-xl bg-action px-4 text-lg font-bold text-on-action disabled:opacity-60';

/** Nouveau lien client : montré une seule fois, envoyé par SMS si demandé. */
export function ClientLinkForm({ jobsiteId, hasPhone }: { jobsiteId: string; hasPhone: boolean }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(createClientLink, null);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="jobsiteId" value={jobsiteId} />
      <label className="flex min-h-10 items-center gap-2">
        <input
          type="checkbox"
          name="sendSms"
          defaultChecked={hasPhone}
          disabled={!hasPhone}
          className="h-6 w-6"
        />
        Envoyer le lien au client par SMS{hasPhone ? '' : ' (pas de téléphone pour ce client)'}
      </label>
      <label className="flex min-h-10 items-center gap-2">
        <input type="checkbox" name="requireSms" disabled={!hasPhone} className="h-6 w-6" />
        Demander un code SMS avant la signature
      </label>
      <button disabled={pending} className={`${primary} self-start`}>
        Créer un lien client (90 jours)
      </button>
      {state?.error ? (
        <span role="alert" className="font-bold text-ko">
          {state.error}
        </span>
      ) : null}
      {state?.url ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3"
        >
          <span className="font-bold">
            {state.smsSent
              ? 'Lien envoyé au client par SMS.'
              : 'Lien créé : il ne sera plus affiché.'}
            {state.smsError ? <span className="text-ko"> {state.smsError}</span> : null}
          </span>
          <code className="break-all text-base">{state.url}</code>
          <button
            type="button"
            className="min-h-10 self-start rounded-lg border border-border px-3"
            onClick={() => navigator.clipboard.writeText(state.url!).then(() => setCopied(true))}
          >
            {copied ? 'Copié' : 'Copier le lien'}
          </button>
        </div>
      ) : null}
    </form>
  );
}

export function CompanySettingsForm({
  phone,
  review,
}: {
  phone: string | null;
  review: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCompanySettings, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-bold">Téléphone de l’entreprise</span>
        <input name="phone" type="tel" defaultValue={phone ?? ''} className={field} />
        <span className="text-base text-text-muted">
          Boutons « Appeler » et « Envoyer un SMS » de la page client.
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">Lien de votre fiche Google (avis)</span>
        <input
          name="review"
          type="url"
          placeholder="https://g.page/r/…"
          defaultValue={review ?? ''}
          className={field}
        />
        <span className="text-base text-text-muted">
          Proposé au client seulement après un PV signé sans réserve, sans aucune contrepartie.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={primary}>
          Enregistrer
        </button>
        {state?.error ? (
          <span role="alert" className="font-bold text-ko">
            {state.error}
          </span>
        ) : null}
        {state?.ok ? (
          <span role="status" className="font-bold text-ok">
            Enregistré
          </span>
        ) : null}
      </div>
    </form>
  );
}
