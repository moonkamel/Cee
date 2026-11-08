// Emplacements de preuve : ordre conseillé et consigne suivante (sections 6 et 7).
import { PROOF_PHASES, type ProofPhase, type ProofSlotStatus } from './statuses';

export type SlotLike = {
  id: string;
  phase: ProofPhase;
  position: number;
  required: boolean;
  status: ProofSlotStatus;
};

/** À photographier : jamais prise, ou à reprendre. */
export function slotNeedsPhoto(slot: Pick<SlotLike, 'status'>): boolean {
  return slot.status === 'missing' || slot.status === 'to_retake';
}

/** Ordre conseillé : avant, pendant, après, puis l'ordre du modèle. */
export function orderSlots<T extends SlotLike>(slots: readonly T[]): T[] {
  return [...slots].sort(
    (a, b) =>
      PROOF_PHASES.indexOf(a.phase) - PROOF_PHASES.indexOf(b.phase) ||
      a.position - b.position ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Prochaine preuve à prendre : la première à photographier après `afterId` dans l'ordre
 * conseillé, sinon depuis le début. Les obligatoires passent d'abord. Null : tout est pris.
 */
export function nextSlot<T extends SlotLike>(
  slots: readonly T[],
  afterId?: string | null,
): T | null {
  const ordered = orderSlots(slots);
  const start = afterId ? ordered.findIndex((s) => s.id === afterId) + 1 : 0;
  const rotated = [...ordered.slice(start), ...ordered.slice(0, start)];
  return (
    rotated.find((s) => s.required && slotNeedsPhoto(s)) ??
    rotated.find((s) => slotNeedsPhoto(s)) ??
    null
  );
}

/** Rang d'une preuve dans l'ordre conseillé : « Photo 3 sur 9 ». */
export function slotRank<T extends SlotLike>(
  slots: readonly T[],
  id: string,
): { rank: number; total: number } {
  const ordered = orderSlots(slots);
  return { rank: ordered.findIndex((s) => s.id === id) + 1, total: ordered.length };
}
