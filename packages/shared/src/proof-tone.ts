import type { ProofSlotStatus } from './statuses';

/** Ton visuel d'une preuve : chaque ton combine toujours icône, mot et couleur (section 3). */
export type ProofTone = 'ok' | 'warn' | 'ko' | 'pending' | 'waived';

const TONES: Record<ProofSlotStatus, ProofTone> = {
  missing: 'ko',
  captured: 'pending',
  analyzing: 'pending',
  compliant: 'ok',
  to_retake: 'warn',
  manually_validated: 'ok',
  waived: 'waived',
};

export function proofTone(status: ProofSlotStatus): ProofTone {
  return TONES[status];
}
