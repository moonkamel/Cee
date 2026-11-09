// Décision du bureau sur une photo orange (section 8) : « Valider » ou « Demander une reprise ».
// L'IA signale, l'humain tranche. Trancher est réservé au chef, au bureau, à l'admin et au
// dirigeant (matrice de la section 14, imposée aussi par la base).
import type { Role } from '../statuses';

export const DECIDER_ROLES: readonly Role[] = ['lead', 'office', 'admin', 'owner'];
export const canDecide = (role: Role | null | undefined) => !!role && DECIDER_ROLES.includes(role);

/** Droits de la matrice de la section 14, pour afficher ou masquer les actions. */
export function permissions(role: Role | null | undefined) {
  return {
    decide: canDecide(role),
    export: role === 'office' || role === 'admin' || role === 'owner',
    editTemplates: role === 'admin' || role === 'owner',
    manageTeam: role === 'admin' || role === 'owner',
    seeAllJobsites: role === 'office' || role === 'admin' || role === 'owner',
  };
}

export const MAX_REQUEST_WORDS = 8;

/** Message de reprise : celui saisi par le bureau, sinon celui de l'IA ; 8 mots au plus. */
export function retakeMessage(
  typed: string | null | undefined,
  aiMessage: string | null | undefined,
): string {
  const pick = (typed ?? '').trim() || (aiMessage ?? '').trim() || 'Photo à reprendre';
  const words = pick.split(/\s+/);
  return words.length > MAX_REQUEST_WORDS ? words.slice(0, MAX_REQUEST_WORDS).join(' ') : pick;
}

export type Decision =
  | { kind: 'validate'; slotId: string }
  | { kind: 'retake'; slotId: string; jobsiteId: string; recipientId: string; message: string };

/** Écritures à faire pour une décision (RLS et triggers vérifient les droits côté base). */
export function decisionWrites(d: Decision, requestedBy: string) {
  if (d.kind === 'validate') {
    return { slot: { id: d.slotId, status: 'manually_validated' as const }, request: null };
  }
  return {
    slot: { id: d.slotId, status: 'to_retake' as const },
    request: {
      jobsite_id: d.jobsiteId,
      proof_slot_id: d.slotId,
      requested_by: requestedBy,
      recipient_id: d.recipientId,
      message: d.message,
    },
  };
}
