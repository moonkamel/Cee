// Envoi des photos (section 6, S7). Voir docs/decisions/0002-envoi-photos.md.
// Le fichier original reste sur le téléphone tant que le serveur n'a pas confirmé son
// empreinte SHA-256 : une coupure, un arrêt de l'appli ou une batterie vide ne perd rien.
import { backoffMs, type SyncEngine } from '../sync/engine';
import type { Row } from '../sync/types';

/** Seuil de batterie sous lequel on n'envoie plus, sauf téléphone en charge. */
export const LOW_BATTERY_LEVEL = 0.15;

export type UploadConditions = {
  online: boolean;
  /** Connexion Wi-Fi (ou filaire) plutôt que données mobiles. */
  wifi: boolean;
  /** Réglage « Wi-Fi uniquement » (désactivé par défaut). */
  wifiOnly: boolean;
  /** Niveau de batterie entre 0 et 1, ou null s'il est inconnu. */
  batteryLevel: number | null;
  charging: boolean;
};

export type UploadBlock = 'offline' | 'wifi' | 'battery';

/** Raison pour laquelle on n'envoie pas maintenant, ou null si l'envoi est permis. */
export function uploadBlock(c: UploadConditions): UploadBlock | null {
  if (!c.online) return 'offline';
  if (c.wifiOnly && !c.wifi) return 'wifi';
  if (!c.charging && c.batteryLevel !== null && c.batteryLevel < LOW_BATTERY_LEVEL)
    return 'battery';
  return null;
}

/** Réponse d'un envoi : `exists` (fichier déjà présent, envoi répété) compte comme réussi. */
export type UploadResult = 'ok' | 'exists' | 'retry' | 'rejected';
/** Contrôle serveur de l'empreinte. `missing` : fichier absent ; `mismatch` : fichier abîmé. */
export type VerifyResult = 'verified' | 'mismatch' | 'missing' | 'retry';

/** Accès au stockage et au téléphone, fourni par l'appli (Supabase Storage, expo-file-system). */
export interface UploadTransport {
  upload(storagePath: string, localUri: string): Promise<UploadResult>;
  verify(photoId: string): Promise<VerifyResult>;
  /** Supprime le fichier original du téléphone (la vignette reste). */
  deleteLocal(localUri: string): Promise<void>;
}

/** Étape locale de l'envoi d'une photo, stockée dans des champs « _ » (jamais envoyés). */
export type UploadStep = 'todo' | 'uploaded' | 'verified';

export type UploadReport = {
  verified: number;
  failed: number;
  /** Photos encore à envoyer après ce passage. */
  waiting: number;
  blocked: UploadBlock | null;
};

function step(photo: Row): UploadStep {
  const s = photo._upload;
  return s === 'uploaded' || s === 'verified' ? s : 'todo';
}

/** Photos prises sur ce téléphone dont l'original n'est pas encore confirmé par le serveur. */
export function photosToUpload(photos: Row[]): Row[] {
  return photos
    .filter((p) => typeof p._localUri === 'string' && p._localUri !== '' && step(p) !== 'verified')
    .sort((a, b) => String(a.device_taken_at).localeCompare(String(b.device_taken_at)));
}

export type PhotoUploader = ReturnType<typeof createPhotoUploader>;

export function createPhotoUploader({
  engine,
  transport,
  now = () => Date.now(),
}: {
  engine: SyncEngine;
  transport: UploadTransport;
  now?: () => number;
}) {
  let running: Promise<UploadReport> | null = null;

  const local = (photo: Row, fields: Row) =>
    engine.write('photos', 'update', { id: photo.id, ...fields });

  async function fail(photo: Row): Promise<void> {
    const attempts = Number(photo._uploadAttempts ?? 0) + 1;
    await local(photo, { _uploadAttempts: attempts, _uploadNextAt: now() + backoffMs(attempts) });
  }

  /** Traite une photo. Renvoie false si le réseau a lâché : inutile d'essayer les suivantes. */
  async function handle(photo: Row, report: UploadReport): Promise<boolean> {
    const id = String(photo.id);
    const localUri = String(photo._localUri);

    if (step(photo) === 'todo') {
      const sent = await transport.upload(String(photo.original_path), localUri);
      if (sent === 'retry') {
        await fail(photo);
        report.failed += 1;
        return false;
      }
      if (sent === 'rejected') {
        await fail(photo);
        report.failed += 1;
        return true;
      }
      await local(photo, { _upload: 'uploaded' });
    }

    const checked = await transport.verify(id);
    if (checked === 'verified') {
      // Seul cas où l'original quitte le téléphone : le serveur a la même empreinte.
      await transport.deleteLocal(localUri);
      await local(photo, {
        _upload: 'verified',
        _localUri: null,
        _uploadAttempts: 0,
        _uploadNextAt: null,
      });
      report.verified += 1;
      return true;
    }
    if (checked === 'retry') {
      await fail(photo);
      report.failed += 1;
      return false;
    }
    // Fichier abîmé ou absent côté serveur : on le renvoie depuis l'original, intact.
    await local(photo, { _upload: 'todo' });
    await fail(photo);
    report.failed += 1;
    return true;
  }

  async function pass(conditions: UploadConditions, force: boolean): Promise<UploadReport> {
    const report: UploadReport = { verified: 0, failed: 0, waiting: 0, blocked: null };
    report.blocked = uploadBlock(conditions);
    if (!report.blocked) {
      for (const photo of photosToUpload(await engine.rows('photos'))) {
        // La fiche de la photo doit être sur le serveur avant son fichier (RLS, contrôle).
        if (!(await engine.isSynced('photos', String(photo.id)))) continue;
        const nextAt = Number(photo._uploadNextAt ?? 0);
        if (!force && nextAt > now()) continue;
        if (!(await handle(photo, report))) {
          report.blocked = 'offline';
          break;
        }
      }
    }
    report.waiting = photosToUpload(await engine.rows('photos')).length;
    return report;
  }

  return {
    /** Nombre de photos dont l'original attend encore la confirmation du serveur. */
    async waitingCount(): Promise<number> {
      return photosToUpload(await engine.rows('photos')).length;
    },

    /**
     * Envoie les photos en attente, la plus ancienne d'abord. Un seul passage à la fois.
     * `force` ignore le délai d'attente après échec (retour du réseau, branchement).
     */
    run(conditions: UploadConditions, { force = false }: { force?: boolean } = {}) {
      if (running) return running;
      running = pass(conditions, force).finally(() => {
        running = null;
      });
      return running;
    },
  };
}
