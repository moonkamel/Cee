import type { ProofSlotStatus } from './statuses';

/** Une preuve compte comme prise dès qu'une photo est capturée, sauf si elle est à reprendre. */
const DONE: ReadonlySet<ProofSlotStatus> = new Set([
  'captured',
  'analyzing',
  'compliant',
  'manually_validated',
  'waived',
]);

/** Progression affichée au poseur : « 4 preuves sur 9 » (preuves obligatoires uniquement). */
export function proofProgress(slots: readonly { status: ProofSlotStatus; required: boolean }[]): {
  done: number;
  total: number;
} {
  const required = slots.filter((s) => s.required);
  return { done: required.filter((s) => DONE.has(s.status)).length, total: required.length };
}
