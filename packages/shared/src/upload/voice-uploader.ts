// Envoi des notes vocales (section 9, S11) : même file que les photos, local d'abord.
// L'audio quitte le téléphone seulement une fois la transcription revenue du serveur.
import { backoffMs, type SyncEngine } from '../sync/engine';
import type { Row } from '../sync/types';
import { uploadBlock, type UploadConditions, type UploadResult } from './photo-uploader';

export interface VoiceTransport {
  upload(storagePath: string, localUri: string): Promise<UploadResult>;
  deleteLocal(localUri: string): Promise<void>;
}

export type VoiceUploadReport = {
  uploaded: number;
  failed: number;
  released: number;
  waiting: number;
};

const hasLocal = (n: Row) => typeof n._localUri === 'string' && n._localUri !== '';

/** Notes enregistrées ici dont l'audio n'est pas encore sur le serveur, la plus ancienne d'abord. */
export function notesToUpload(notes: Row[]): Row[] {
  return notes
    .filter((n) => hasLocal(n) && n.upload_status !== 'uploaded' && !n.deleted_at)
    .sort((a, b) => String(a.created_at ?? a.id).localeCompare(String(b.created_at ?? b.id)));
}

export function createVoiceUploader({
  engine,
  transport,
  now = () => Date.now(),
}: {
  engine: SyncEngine;
  transport: VoiceTransport;
  now?: () => number;
}) {
  let running: Promise<VoiceUploadReport> | null = null;

  async function pass(conditions: UploadConditions, force: boolean): Promise<VoiceUploadReport> {
    const report: VoiceUploadReport = { uploaded: 0, failed: 0, released: 0, waiting: 0 };
    const notes = await engine.rows('voice_notes');

    // Transcription revenue : l'audio est sur le serveur pour de bon, le téléphone se libère.
    for (const n of notes) {
      if (hasLocal(n) && n.upload_status === 'uploaded' && n.status === 'done') {
        await transport.deleteLocal(String(n._localUri));
        await engine.write('voice_notes', 'update', { id: n.id, _localUri: null });
        report.released += 1;
      }
    }

    if (!uploadBlock(conditions)) {
      for (const n of notesToUpload(notes)) {
        if (!(await engine.isSynced('voice_notes', String(n.id)))) continue;
        if (!force && Number(n._uploadNextAt ?? 0) > now()) continue;
        const sent = await transport.upload(String(n.audio_path), String(n._localUri));
        if (sent === 'ok' || sent === 'exists') {
          await engine.write('voice_notes', 'update', { id: n.id, upload_status: 'uploaded' });
          report.uploaded += 1;
          continue;
        }
        const attempts = Number(n._uploadAttempts ?? 0) + 1;
        await engine.write('voice_notes', 'update', {
          id: n.id,
          _uploadAttempts: attempts,
          _uploadNextAt: now() + backoffMs(attempts),
        });
        report.failed += 1;
        if (sent === 'retry') break; // réseau tombé : inutile d'essayer les suivantes
      }
    }
    report.waiting = notesToUpload(await engine.rows('voice_notes')).length;
    return report;
  }

  return {
    run(conditions: UploadConditions, { force = false }: { force?: boolean } = {}) {
      if (running) return running;
      running = pass(conditions, force).finally(() => {
        running = null;
      });
      return running;
    },
  };
}
