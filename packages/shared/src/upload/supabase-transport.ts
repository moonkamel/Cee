// Envoi par Supabase Storage (envoi simple, sans reprise : voir 0002-envoi-photos.md)
// et contrôle par l'Edge Function verify-photo.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UploadResult, UploadTransport, VerifyResult } from './photo-uploader';
import type { VoiceTransport } from './voice-uploader';

export const PHOTO_BUCKET = 'photos';

type StorageErrorLike = { statusCode?: string; status?: number; message?: string } | null;

/**
 * Erreur du stockage → suite à donner. Le stockage répond souvent 400 avec le vrai code dans
 * `statusCode` (« 409 » : déjà présent, « 403 » : RLS, « 413 » : trop gros).
 */
export function classifyUploadError(error: StorageErrorLike): UploadResult {
  if (!error) return 'ok';
  const code = String(error.statusCode ?? error.status ?? '');
  const message = error.message ?? '';
  if (code === '409' || /already exists|duplicate/i.test(message)) return 'exists';
  // Session expirée : elle sera rafraîchie, on réessaiera.
  if (/jwt|token|exp/i.test(message) || code === '401') return 'retry';
  if (['400', '403', '404', '413', '415', '422'].includes(code)) return 'rejected';
  return 'retry';
}

/** Statut HTTP de verify-photo (ou null : réseau, relais) → verdict. */
export function classifyVerifyStatus(status: number | null): VerifyResult {
  if (status === 200) return 'verified';
  if (status === 409) return 'mismatch';
  if (status === 404) return 'missing';
  return 'retry';
}

/** Étape d'un envoi qui a échoué, pour le suivi des erreurs (jamais montré au poseur). */
export type UploadErrorStage = 'read' | 'upload' | 'verify';
export type UploadErrorHandler = (stage: UploadErrorStage, error: unknown) => void;

/** Lecture du fichier puis envoi au stockage, commun aux photos et aux notes vocales. */
async function sendFile(
  client: SupabaseClient,
  files: { read(localUri: string): Promise<Uint8Array> },
  bucket: string,
  contentType: string,
  storagePath: string,
  localUri: string,
  onError: UploadErrorHandler,
): Promise<UploadResult> {
  let bytes: Uint8Array;
  try {
    bytes = await files.read(localUri);
  } catch (error) {
    onError('read', error);
    return 'rejected';
  }
  try {
    const { error } = await client.storage
      .from(bucket)
      .upload(storagePath, bytes, { contentType, upsert: false });
    const result = classifyUploadError(error as StorageErrorLike);
    if (result === 'retry' || result === 'rejected') onError('upload', error);
    return result;
  } catch (error) {
    onError('upload', error);
    return 'retry';
  }
}

export function createSupabaseUploadTransport(
  client: SupabaseClient,
  files: {
    /** Lit le fichier original ; lève une erreur s'il est illisible. */
    read(localUri: string): Promise<Uint8Array>;
    remove(localUri: string): Promise<void>;
  },
  onError: UploadErrorHandler = () => undefined,
): UploadTransport {
  return {
    upload: (storagePath, localUri) =>
      sendFile(client, files, PHOTO_BUCKET, 'image/jpeg', storagePath, localUri, onError),

    async verify(photoId) {
      try {
        const { error } = await client.functions.invoke('verify-photo', {
          body: { photo_id: photoId },
        });
        if (!error) return 'verified';
        const context = (error as { context?: { status?: number } }).context;
        const result = classifyVerifyStatus(
          typeof context?.status === 'number' ? context.status : null,
        );
        if (result === 'retry') onError('verify', error);
        return result;
      } catch (error) {
        onError('verify', error);
        return 'retry';
      }
    },

    deleteLocal: (localUri) => files.remove(localUri),
  };
}

export const VOICE_BUCKET = 'voice-notes';

/** Envoi de l'audio d'une note (pas de contrôle d'empreinte : la transcription fait foi). */
export function createSupabaseVoiceTransport(
  client: SupabaseClient,
  files: { read(localUri: string): Promise<Uint8Array>; remove(localUri: string): Promise<void> },
  onError: UploadErrorHandler = () => undefined,
): VoiceTransport {
  return {
    upload: (storagePath, localUri) =>
      sendFile(client, files, VOICE_BUCKET, 'audio/mp4', storagePath, localUri, onError),
    deleteLocal: (localUri) => files.remove(localUri),
  };
}
