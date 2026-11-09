// Score de conformité d'un chantier (section 10) : preuves obligatoires conformes ou validées
// à la main, sur les preuves obligatoires attendues. Trois états, toujours icône et mot.
import type { ProofSlotStatus } from '../statuses';

export type ScoredSlot = {
  status: ProofSlotStatus;
  required: boolean;
  applicable?: boolean;
  /** Dispense validée par le bureau (une dispense non validée met le chantier « à risque »). */
  waiverValidated?: boolean;
};

export type JobsiteState = 'complete' | 'to_complete' | 'at_risk';

const OK: ReadonlySet<ProofSlotStatus> = new Set(['compliant', 'manually_validated']);

export function jobsiteScore(slots: readonly ScoredSlot[]): {
  ok: number;
  total: number;
  percent: number;
} {
  const required = slots.filter((s) => s.required && s.applicable !== false);
  // Une dispense validée par le bureau compte comme une preuve réglée.
  const ok = required.filter(
    (s) => OK.has(s.status) || (s.status === 'waived' && s.waiverValidated),
  ).length;
  return {
    ok,
    total: required.length,
    percent: required.length ? Math.round((100 * ok) / required.length) : 0,
  };
}

/**
 * « À risque » : une photo orange non tranchée ou une dispense en attente.
 * « Complet » : 100 %. Sinon « À compléter ». Un chantier sans checklist est « à compléter ».
 */
export function jobsiteState(slots: readonly ScoredSlot[]): JobsiteState {
  const applicable = slots.filter((s) => s.applicable !== false);
  if (
    applicable.some(
      (s) => s.status === 'to_retake' || (s.status === 'waived' && !s.waiverValidated),
    )
  ) {
    return 'at_risk';
  }
  const { ok, total } = jobsiteScore(applicable);
  return total > 0 && ok === total ? 'complete' : 'to_complete';
}
