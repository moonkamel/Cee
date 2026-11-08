import {
  buildPhotoRow,
  buildQuickJobsite,
  slotNeedsPhoto,
  type PhotoSource,
  type ProofPhase,
  type ProofSlotStatus,
  type Role,
  type Row,
  type SyncEngine,
  type WorkType,
} from '@preuvio/shared';
import { localToday } from '@/lib/position';
import type { DataSource, Jobsite, PhotoSummary, Profile, ProofSlot } from './types';

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** Assemble les lignes locales (chantiers, clients, opérations, preuves) en chantiers affichables. */
export function assembleJobsites(tables: {
  jobsites: Row[];
  clients: Row[];
  operations: Row[];
  slots: Row[];
}): Jobsite[] {
  const clients = new Map(tables.clients.map((c) => [c.id, c]));
  return tables.jobsites
    .filter((j) => j.status === 'planned' || j.status === 'in_progress')
    .map((j) => ({
      id: String(j.id),
      reference: str(j.reference),
      address: str(j.address) ?? '',
      status: j.status as Jobsite['status'],
      plannedStart: str(j.planned_start),
      plannedEnd: str(j.planned_end),
      lat: num(j.lat),
      lng: num(j.lng),
      geofenceRadiusM: num(j.geofence_radius_m) ?? 150,
      clientName: str(clients.get(j.client_id)?.full_name),
      operations: tables.operations
        .filter((o) => o.jobsite_id === j.id)
        .map((o) => String(o.label)),
      workTypes: Array.isArray(j.work_types) ? (j.work_types as WorkType[]) : [],
      proofs: tables.slots
        .filter((s) => s.jobsite_id === j.id)
        .map((s) => ({ status: s.status as ProofSlotStatus, required: s.required !== false })),
      addressPending: j._addressPending === true,
    }))
    .sort(
      (a, b) =>
        (a.plannedStart ?? '').localeCompare(b.plannedStart ?? '') || a.id.localeCompare(b.id),
    );
}

export function toProofSlot(s: Row): ProofSlot {
  return {
    id: String(s.id),
    jobsiteId: String(s.jobsite_id),
    instruction: str(s.instruction) ?? '',
    phase: s.phase as ProofPhase,
    position: num(s.position) ?? 0,
    required: s.required !== false,
    status: s.status as ProofSlotStatus,
  };
}

export function toPhotoSummary(p: Row): PhotoSummary {
  return {
    id: String(p.id),
    proofSlotId: str(p.proof_slot_id),
    thumbUri: str(p._thumbUri) ?? str(p._localUri),
    takenAt: str(p.device_taken_at) ?? '',
    outsideGeofence: p.outside_geofence === true,
    source: (p.source as PhotoSource) ?? 'camera',
  };
}

export function createLocalSource({
  engine,
  currentUserId,
  newId,
  deviceInfo = { model: null, appVersion: null },
}: {
  engine: SyncEngine;
  currentUserId: () => string | null;
  newId: () => string;
  deviceInfo?: { model: string | null; appVersion: string | null };
}): DataSource {
  async function list() {
    const [jobsites, clients, operations, slots, status] = await Promise.all([
      engine.rows('jobsites'),
      engine.rows('clients'),
      engine.rows('jobsite_operations'),
      engine.rows('proof_slots'),
      engine.status(),
    ]);
    return {
      data: assembleJobsites({ jobsites, clients, operations, slots }),
      stale: status.offline,
      fetchedAt: status.lastSyncAt ?? new Date().toISOString(),
    };
  }

  return {
    listJobsites: list,
    cachedJobsites: list,

    async getProfile(userId): Promise<Profile | null> {
      const profile = (await engine.rows('profiles')).find((p) => p.id === userId);
      if (!profile) return null;
      const company = (await engine.rows('companies')).find((c) => c.id === profile.company_id);
      return {
        id: userId,
        fullName: str(profile.full_name) ?? '',
        role: profile.role as Role,
        companyName: str(company?.name),
      };
    },

    async createJobsite(input) {
      const userId = currentUserId();
      if (!userId) throw new Error('Utilisateur non connecté');
      const rows = buildQuickJobsite({ ...input, today: localToday(), userId, newId });
      if (rows.client) await engine.write('clients', 'insert', rows.client);
      await engine.write('jobsites', 'insert', rows.jobsite);
      await engine.write('jobsite_assignees', 'insert', rows.assignee);
      // Envoi immédiat si le réseau est là ; sinon la file attend, sans bloquer l'écran.
      void engine.sync().catch(() => undefined);
      return String(rows.jobsite.id);
    },

    async listSlots(jobsiteId) {
      return (await engine.rows('proof_slots'))
        .filter((s) => s.jobsite_id === jobsiteId)
        .map(toProofSlot);
    },

    async listPhotos(jobsiteId) {
      return (await engine.rows('photos'))
        .filter((p) => p.jobsite_id === jobsiteId && !p.deleted_at)
        .map(toPhotoSummary)
        .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
    },

    async recordPhoto(input) {
      const userId = currentUserId();
      if (!userId) throw new Error('Utilisateur non connecté');
      const profile = (await engine.rows('profiles')).find((p) => p.id === userId);
      const companyId = str(profile?.company_id);
      if (!companyId) throw new Error('Entreprise inconnue : synchronisation pas encore faite');
      const jobsite = (await engine.rows('jobsites')).find((j) => j.id === input.jobsiteId);
      const row = buildPhotoRow(
        {
          ...input,
          companyId,
          authorId: userId,
          deviceModel: deviceInfo.model,
          appVersion: deviceInfo.appVersion,
        },
        {
          lat: num(jobsite?.lat),
          lng: num(jobsite?.lng),
          geofenceRadiusM: num(jobsite?.geofence_radius_m) ?? 150,
        },
      );
      // Champs locaux : le fichier reste sur le téléphone jusqu'à son envoi (S7).
      await engine.write('photos', 'insert', {
        ...row,
        _localUri: input.localUri,
        _thumbUri: input.thumbUri,
      });
      if (row.proof_slot_id) {
        const slot = (await engine.rows('proof_slots')).find((s) => s.id === row.proof_slot_id);
        if (slot && slotNeedsPhoto(toProofSlot(slot))) {
          await engine.write('proof_slots', 'update', {
            id: row.proof_slot_id,
            status: 'captured',
          });
        }
      }
      void engine.sync().catch(() => undefined);
    },

    syncStatus: () => engine.status(),
    syncNow: async () => {
      await engine.sync({ force: true });
    },
    onChange: (listener) => engine.onChange(listener),
    reset: () => engine.reset(),
  };
}
