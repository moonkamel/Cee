'use client';

import { type BillingInterval, type Plan, PLAN_INFO, priceLabel } from '@preuvio/shared';
import { useActionState, useState } from 'react';
import type { FormState } from '@/app/actions';
import { createArchive, openPortal, startCheckout } from '@/app/billing-actions';

const primary =
  'min-h-12 rounded-xl bg-action px-4 text-lg font-bold text-on-action disabled:opacity-60';
const secondary = 'min-h-12 rounded-xl border border-border px-4 font-bold disabled:opacity-60';

function Alert({ state }: { state: FormState }) {
  return state?.error ? (
    <p role="alert" className="font-bold text-ko">
      {state.error}
    </p>
  ) : null;
}

/** Offres Solo et Équipe (mensuel ou annuel), Entreprise sur devis. */
export function PlanPicker({ current }: { current: Plan | null }) {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [state, action, pending] = useActionState<FormState, FormData>(startCheckout, null);
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 font-bold">Paiement</legend>
        {(['month', 'year'] as const).map((i) => (
          <label
            key={i}
            className="flex min-h-12 items-center gap-2 rounded-lg border border-border px-3"
          >
            <input
              type="radio"
              name="period"
              checked={interval === i}
              onChange={() => setInterval(i)}
              className="h-5 w-5"
            />
            {i === 'month' ? 'Mensuel' : 'Annuel (deux mois offerts)'}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        {(['solo', 'team', 'enterprise'] as const).map((plan) => {
          const info = PLAN_INFO[plan];
          return (
            <form
              key={plan}
              action={action}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <input type="hidden" name="plan" value={plan} />
              <input type="hidden" name="interval" value={interval} />
              <h3 className="text-xl font-bold">{info.label}</h3>
              <p className="text-2xl font-bold">{priceLabel(plan, interval)}</p>
              <p className="text-text-muted">
                {info.seats ? `Jusqu’à ${info.seats} utilisateurs` : 'Plus de 10 utilisateurs'}
              </p>
              <p>{info.summary}</p>
              {plan === 'enterprise' ? (
                <p className="font-bold">Contactez Preuvio pour un devis.</p>
              ) : current === plan ? (
                <p className="font-bold text-ok">✓ Offre actuelle</p>
              ) : current ? null : (
                <button disabled={pending} className={primary}>
                  Choisir {info.label}
                </button>
              )}
            </form>
          );
        })}
      </div>
      <Alert state={state} />
    </div>
  );
}

/** Portail Stripe : factures, moyen de paiement, changement d'offre, résiliation. */
export function PortalButton() {
  const [state, action, pending] = useActionState<FormState, FormData>(openPortal, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <button disabled={pending} className={`${primary} self-start`}>
        Gérer l’abonnement et les factures
      </button>
      <Alert state={state} />
    </form>
  );
}

export function ArchiveButton() {
  const [state, action, pending] = useActionState<FormState, FormData>(createArchive, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <button disabled={pending} className={`${secondary} self-start`}>
        Exporter toutes mes données
      </button>
      <Alert state={state} />
    </form>
  );
}
