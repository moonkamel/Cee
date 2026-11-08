// Création rapide d'un chantier sur le terrain (section 6) : adresse, travaux, client.
import { normalizeFrenchPhone } from '../phone';
import { WORK_TYPES, type WorkType } from '../statuses';
import type { Row } from './types';

export type QuickJobsiteInput = {
  address: {
    label: string;
    banId: string | null;
    lat: number | null;
    lng: number | null;
    /** Adresse à compléter au retour du réseau (seule la position est connue). */
    pending: boolean;
  };
  workTypes: readonly WorkType[];
  client: { fullName: string; phone: string | null } | null;
  /** Date du jour, AAAA-MM-JJ. */
  today: string;
  userId: string;
  newId: () => string;
};

export type QuickJobsiteRows = { client: Row | null; jobsite: Row; assignee: Row };

export class QuickJobsiteError extends Error {}

/**
 * Lignes à écrire, dans l'ordre : client, chantier, affectation du poseur qui le crée.
 * L'entreprise et l'auteur sont imposés par le serveur (triggers), jamais envoyés.
 */
export function buildQuickJobsite(input: QuickJobsiteInput): QuickJobsiteRows {
  const label = input.address.label.trim();
  if (!label) throw new QuickJobsiteError('Adresse manquante');
  if (input.workTypes.length === 0)
    throw new QuickJobsiteError('Choisissez au moins un type de travaux');
  if (input.workTypes.some((w) => !WORK_TYPES.includes(w))) {
    throw new QuickJobsiteError('Type de travaux inconnu');
  }

  const clientName = input.client?.fullName.trim() ?? '';
  const client: Row | null = clientName
    ? {
        id: input.newId(),
        full_name: clientName,
        phone: input.client?.phone ? normalizeFrenchPhone(input.client.phone) : null,
        address: input.address.pending ? null : label,
        ban_id: input.address.banId,
        lat: input.address.lat,
        lng: input.address.lng,
      }
    : null;

  const jobsiteId = input.newId();
  const jobsite: Row = {
    id: jobsiteId,
    client_id: client?.id ?? null,
    address: label,
    ban_id: input.address.banId,
    lat: input.address.lat,
    lng: input.address.lng,
    planned_start: input.today,
    planned_end: input.today,
    status: 'in_progress',
    work_types: [...new Set(input.workTypes)],
    // Champ local : l'adresse sera complétée au retour du réseau.
    ...(input.address.pending ? { _addressPending: true } : {}),
  };

  const assignee: Row = { jobsite_id: jobsiteId, profile_id: input.userId };
  return { client, jobsite, assignee };
}
