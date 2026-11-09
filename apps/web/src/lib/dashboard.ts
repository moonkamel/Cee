// Vue du tableau de bord (sections 10 et 14) construite à partir des lignes lues avec la session
// de l'utilisateur (la RLS a déjà filtré). Fonctions pures, testées.
import {
  batchStatus,
  jobsiteScore,
  jobsiteState,
  sortTodo,
  type InspectionResult,
  type JobsiteState,
  type ProofSlotStatus,
  type TodoItem,
} from '@preuvio/shared';

export type SlotRow = {
  id: string;
  instruction: string;
  status: ProofSlotStatus;
  required: boolean;
  applicable: boolean;
  waiver_reason: string | null;
  waiver_validated_at: string | null;
  updated_at: string;
  photos: {
    id: string;
    original_path: string;
    device_taken_at: string;
    author_id: string;
    ai_result: { decision?: { kind?: string; message?: string; reason?: string } } | null;
    ai_kept_at: string | null;
    deleted_at: string | null;
  }[];
};

export type JobsiteRow = {
  id: string;
  address: string;
  reference: string | null;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  lat: number | null;
  lng: number | null;
  updated_at: string;
  clients: { full_name: string } | null;
  jobsite_assignees: { profile_id: string; profiles: { full_name: string } | null }[];
  proof_slots: SlotRow[];
};

export type NoteItemRow = {
  id: string;
  jobsite_id: string;
  kind: 'problem' | 'material';
  summary: string;
  quantity: number | null;
  unit: string | null;
  created_at: string;
};

export type BatchRow = {
  id: string;
  operation_code: string;
  inspections: { result: InspectionResult }[];
};

const ACTIVE = new Set(['planned', 'in_progress', 'completed_by_installer']);

/** Dernière photo non retirée d'une preuve. */
export function latestPhoto(slot: SlotRow) {
  return [...slot.photos]
    .filter((p) => !p.deleted_at)
    .sort((a, b) => b.device_taken_at.localeCompare(a.device_taken_at))[0];
}

export type JobsiteView = {
  id: string;
  label: string;
  client: string | null;
  installers: string[];
  status: string;
  state: JobsiteState;
  score: { ok: number; total: number; percent: number };
  lat: number | null;
  lng: number | null;
  today: boolean;
};

export function jobsiteView(j: JobsiteRow, today: string): JobsiteView {
  const slots = j.proof_slots.map((s) => ({
    ...s,
    waiverValidated: Boolean(s.waiver_validated_at),
  }));
  return {
    id: j.id,
    label: j.address || j.reference || 'Chantier',
    client: j.clients?.full_name ?? null,
    installers: j.jobsite_assignees.map((a) => a.profiles?.full_name ?? '').filter(Boolean),
    status: j.status,
    state: jobsiteState(slots),
    score: jobsiteScore(slots),
    lat: j.lat,
    lng: j.lng,
    today:
      j.status === 'in_progress' ||
      (!!j.planned_start &&
        j.planned_start <= today &&
        (j.planned_end ?? j.planned_start) >= today),
  };
}

/** Liste « À traiter », triée par gravité. */
export function todoItems(jobsites: JobsiteRow[], notes: NoteItemRow[]): TodoItem[] {
  const items: TodoItem[] = [];
  const labels = new Map(jobsites.map((j) => [j.id, j.address || j.reference || 'Chantier']));
  for (const j of jobsites) {
    const label = labels.get(j.id)!;
    for (const s of j.proof_slots) {
      if (!s.applicable) continue;
      if (s.status === 'to_retake') {
        const photo = latestPhoto(s);
        items.push({
          kind: 'orange_photo',
          id: s.id,
          jobsiteId: j.id,
          jobsiteLabel: label,
          title: s.instruction,
          detail: photo?.ai_result?.decision?.message ?? null,
          since: s.updated_at,
          keptByInstaller: Boolean(photo?.ai_kept_at),
        });
      } else if (s.status === 'waived' && !s.waiver_validated_at) {
        items.push({
          kind: 'waiver',
          id: s.id,
          jobsiteId: j.id,
          jobsiteLabel: label,
          title: s.instruction,
          detail: s.waiver_reason,
          since: s.updated_at,
        });
      }
    }
    const missing = j.proof_slots.filter(
      (s) => s.applicable && s.required && (s.status === 'missing' || s.status === 'to_retake'),
    ).length;
    if (j.status === 'completed_by_installer' && missing > 0) {
      items.push({
        kind: 'finished_incomplete',
        id: j.id,
        jobsiteId: j.id,
        jobsiteLabel: label,
        title: `${missing} preuve(s) manquante(s)`,
        detail: null,
        since: j.updated_at,
      });
    }
  }
  for (const n of notes) {
    items.push({
      kind: n.kind,
      id: n.id,
      jobsiteId: n.jobsite_id,
      jobsiteLabel: labels.get(n.jobsite_id) ?? 'Chantier',
      title:
        n.kind === 'material'
          ? [n.quantity, n.unit, n.summary].filter((v) => v !== null && v !== '').join(' ')
          : n.summary,
      detail: null,
      since: n.created_at,
    });
  }
  return sortTodo(items);
}

export type Tiles = { inProgress: number; atRisk: number; orange: number; batchesNear: number };

export function tiles(
  jobsites: JobsiteRow[],
  batches: BatchRow[],
  threshold: number,
  today: string,
): Tiles {
  const views = jobsites.filter((j) => ACTIVE.has(j.status)).map((j) => jobsiteView(j, today));
  return {
    inProgress: views.filter((v) => v.status !== 'completed_by_installer').length,
    atRisk: views.filter((v) => v.state === 'at_risk').length,
    orange: jobsites
      .flatMap((j) => j.proof_slots)
      .filter((s) => s.applicable && s.status === 'to_retake').length,
    batchesNear: batches.filter(
      (b) =>
        batchStatus(
          b.inspections.map((i) => i.result),
          threshold,
        ).near,
    ).length,
  };
}

export const TILE_FILTERS = ['en-cours', 'a-risque', 'photos-orange'] as const;
export type TileFilter = (typeof TILE_FILTERS)[number];

/** Liste filtrée ouverte depuis une tuile. */
export function filterJobsites(
  views: JobsiteView[],
  jobsites: JobsiteRow[],
  filter: TileFilter | null,
) {
  if (filter === 'a-risque') return views.filter((v) => v.state === 'at_risk');
  if (filter === 'photos-orange') {
    const ids = new Set(
      jobsites
        .filter((j) => j.proof_slots.some((s) => s.applicable && s.status === 'to_retake'))
        .map((j) => j.id),
    );
    return views.filter((v) => ids.has(v.id));
  }
  if (filter === 'en-cours')
    return views.filter((v) => v.status === 'in_progress' || v.status === 'planned');
  return views;
}
