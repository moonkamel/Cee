import {
  buildOperation,
  buildPhotoRow,
  buildQuickJobsite,
  effectiveAnswers,
  parseTemplate,
  pickTemplate,
  planSlots,
  photosToUpload,
  reconcileSlots,
  slotRow,
  WORK_TYPE_TEMPLATES,
  type ChecklistAnswers,
  type ChecklistTemplate,
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
import { WIFI_ONLY_META } from './settings';
import type { DataSource, Jobsite, Operation, PhotoSummary, Profile, ProofSlot } from './types';
import type { UploadRunner } from './upload-runner';

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
        .filter((s) => s.jobsite_id === j.id && s.applicable !== false)
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
    operationId: str(s.operation_id),
    instruction: str(s.instruction) ?? '',
    phase: s.phase as ProofPhase,
    position: num(s.position) ?? 0,
    required: s.required !== false,
    minPhotos: num(s.min_photos) ?? 1,
    status: s.status as ProofSlotStatus,
    applicable: s.applicable !== false,
    waiverReason: str(s.waiver_reason),
    waiverValidated: Boolean(s.waiver_validated_at),
    aiMessage: null,
    aiKept: false,
  };
}

/** Dernière photo (non retirée) de chaque preuve, pour l'alerte de l'IA. */
function latestPhotoBySlot(photos: Row[]): Map<string, Row> {
  const latest = new Map<string, Row>();
  for (const p of photos) {
    const slot = str(p.proof_slot_id);
    if (!slot || p.deleted_at) continue;
    const current = latest.get(slot);
    if (!current || String(p.device_taken_at) > String(current.device_taken_at))
      latest.set(slot, p);
  }
  return latest;
}

/** Alerte orange de l'IA (S10) : message à montrer au poseur, et s'il l'a gardée. */
export function withAiAlert(slot: ProofSlot, photo: Row | undefined): ProofSlot {
  const decision = (photo?.ai_result as { decision?: { kind?: string; message?: string } } | null)
    ?.decision;
  if (slot.status !== 'to_retake' || decision?.kind !== 'retake') return slot;
  return { ...slot, aiMessage: decision.message ?? null, aiKept: Boolean(photo?.ai_kept_at) };
}

/** Modèle figé d'une opération, ou null s'il est illisible (ancienne démonstration). */
function snapshotOf(operation: Row): ChecklistTemplate | null {
  try {
    return parseTemplate(operation.template_snapshot);
  } catch {
    return null;
  }
}

const answersOf = (operation: Row): ChecklistAnswers =>
  operation.answers && typeof operation.answers === 'object'
    ? (operation.answers as ChecklistAnswers)
    : {};

export function toOperation(o: Row): Operation {
  const template = snapshotOf(o);
  const answers = template ? effectiveAnswers(template, answersOf(o)) : {};
  return {
    id: String(o.id),
    label: str(o.label) ?? '',
    draft: template?.review.status !== 'reviewed',
    questions: (template?.questions ?? []).map((q) =>
      q.type === 'yes_no'
        ? {
            key: q.key,
            label: q.label,
            type: 'yes_no' as const,
            value: typeof answers[q.key] === 'boolean' ? (answers[q.key] as boolean) : null,
          }
        : {
            key: q.key,
            label: q.label,
            type: 'number' as const,
            min: q.min,
            max: q.max,
            value: Number(answers[q.key] ?? q.default),
          },
    ),
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
  uploads = null,
}: {
  engine: SyncEngine;
  currentUserId: () => string | null;
  newId: () => string;
  deviceInfo?: { model: string | null; appVersion: string | null };
  /** Envoi des photos (absent dans les tests qui n'en ont pas besoin). */
  uploads?: UploadRunner | null;
}): DataSource {
  /** Synchronise, puis envoie les fichiers dont la fiche vient d'arriver au serveur. */
  const syncThenUpload = (force = false) =>
    void engine
      .sync({ force })
      .then(() => uploads?.run(force))
      .catch(() => undefined);

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
      // Checklist générée sur le téléphone, réseau ou pas, depuis les modèles synchronisés.
      const templates = await engine.rows('checklist_templates');
      for (const workType of input.workTypes) {
        const code = WORK_TYPE_TEMPLATES[workType];
        const templateRow = code ? pickTemplate(templates, code, localToday()) : null;
        if (!templateRow) continue;
        const { operation, slots } = buildOperation({
          jobsiteId: String(rows.jobsite.id),
          templateRow,
          newId,
        });
        await engine.write('jobsite_operations', 'insert', operation);
        for (const slot of slots) await engine.write('proof_slots', 'insert', slot);
      }
      // Envoi immédiat si le réseau est là ; sinon la file attend, sans bloquer l'écran.
      syncThenUpload();
      return String(rows.jobsite.id);
    },

    async listSlots(jobsiteId) {
      const latest = latestPhotoBySlot(
        (await engine.rows('photos')).filter((p) => p.jobsite_id === jobsiteId),
      );
      return (await engine.rows('proof_slots'))
        .filter((s) => s.jobsite_id === jobsiteId && s.applicable !== false)
        .map((s) => withAiAlert(toProofSlot(s), latest.get(String(s.id))));
    },

    async keepDespiteAi(slotId) {
      const photo = latestPhotoBySlot(await engine.rows('photos')).get(slotId);
      if (!photo || photo.ai_kept_at) return;
      await engine.write('photos', 'update', {
        id: photo.id,
        ai_kept_at: new Date().toISOString(),
      });
      syncThenUpload();
    },

    async listOperations(jobsiteId) {
      return (await engine.rows('jobsite_operations'))
        .filter((o) => o.jobsite_id === jobsiteId)
        .map(toOperation);
    },

    async answerQuestion(operationId, key, value) {
      const operation = (await engine.rows('jobsite_operations')).find((o) => o.id === operationId);
      if (!operation) throw new Error('Opération inconnue');
      const template = snapshotOf(operation);
      if (!template) return;
      const answers = { ...answersOf(operation), [key]: value };
      await engine.write('jobsite_operations', 'update', { id: operationId, answers });

      const existing = (await engine.rows('proof_slots')).filter(
        (s) => s.operation_id === operationId,
      );
      const { insert, update } = reconcileSlots(
        existing.map((s) => ({
          id: String(s.id),
          item_key: String(s.item_key),
          instruction: str(s.instruction) ?? '',
          position: num(s.position) ?? 0,
          applicable: s.applicable !== false,
        })),
        planSlots(template, answers),
      );
      for (const u of update)
        await engine.write('proof_slots', 'update', { id: u.id, ...u.changes });
      for (const p of insert) {
        await engine.write(
          'proof_slots',
          'insert',
          slotRow(p, { id: newId(), jobsiteId: String(operation.jobsite_id), operationId }),
        );
      }
      syncThenUpload();
    },

    async waiveSlot(slotId, reason) {
      await engine.write('proof_slots', 'update', {
        id: slotId,
        status: 'waived',
        waiver_reason: reason,
      });
      syncThenUpload();
    },

    async finishJobsite(jobsiteId) {
      await engine.write('jobsites', 'update', {
        id: jobsiteId,
        status: 'completed_by_installer',
      });
      syncThenUpload();
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
        local_check: input.localCheck ?? null,
        _localUri: input.localUri,
        _thumbUri: input.thumbUri,
      });
      if (row.proof_slot_id) {
        const slot = (await engine.rows('proof_slots')).find((s) => s.id === row.proof_slot_id);
        // « Capturée » une fois le nombre minimal de photos atteint (2 vues, par exemple).
        const taken = (await engine.rows('photos')).filter(
          (p) => p.proof_slot_id === row.proof_slot_id && !p.deleted_at,
        ).length;
        if (slot && slotNeedsPhoto(toProofSlot(slot)) && taken >= (num(slot.min_photos) ?? 1)) {
          await engine.write('proof_slots', 'update', {
            id: row.proof_slot_id,
            status: 'captured',
          });
        }
      }
      syncThenUpload();
    },

    async resolvePhotoCheck(photoId, keep) {
      const photo = (await engine.rows('photos')).find((p) => p.id === photoId);
      if (!photo || photo.deleted_at) return;
      const check = { ...((photo.local_check as Row | null) ?? {}), kept: keep };
      if (keep) {
        await engine.write('photos', 'update', { id: photoId, local_check: check });
      } else {
        // Retrait logique : le fichier et sa fiche restent (valeur probante, section 16).
        await engine.write('photos', 'update', {
          id: photoId,
          local_check: check,
          deleted_at: new Date().toISOString(),
        });
        const slotId = str(photo.proof_slot_id);
        const slot = slotId
          ? (await engine.rows('proof_slots')).find((s) => s.id === slotId)
          : null;
        if (slot && slot.status === 'captured') {
          const left = (await engine.rows('photos')).filter(
            (p) => p.proof_slot_id === slotId && !p.deleted_at,
          ).length;
          if (left < (num(slot.min_photos) ?? 1)) {
            await engine.write('proof_slots', 'update', { id: slotId, status: 'missing' });
          }
        }
      }
      syncThenUpload();
    },

    async syncStatus() {
      const [status, photos] = await Promise.all([engine.status(), engine.rows('photos')]);
      return {
        ...status,
        photosWaiting: photosToUpload(photos).length,
        uploadBlocked: uploads?.blocked() ?? null,
      };
    },
    syncNow: async () => {
      await engine.sync({ force: true });
      await uploads?.run(true);
    },
    async getWifiOnly() {
      return (await engine.getMeta(WIFI_ONLY_META)) === '1';
    },
    async setWifiOnly(value) {
      await engine.setMeta(WIFI_ONLY_META, value ? '1' : '0');
      if (!value) void uploads?.run(true).catch(() => undefined);
    },
    onChange(listener) {
      const offEngine = engine.onChange(listener);
      const offUploads = uploads?.onChange(listener);
      return () => {
        offEngine();
        offUploads?.();
      };
    },
    reset: () => engine.reset(),
  };
}
