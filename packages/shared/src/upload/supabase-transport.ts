// Envoi par Supabase Storage (envoi simple, sans reprise : voir 0002-envoi-photos.md)
// et contrôle par l'Edge Function verify-photo.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UploadResult, UploadTransport, VerifyResult } from './photo-uploader';

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

export function createSupabaseUploadTransport(
  client: SupabaseClient,
  files: {
    /** Lit le fichier original ; lève une erreur s'il est illisible. */
    read(localUri: string): Promise<Uint8Array>;
    remove(localUri: string): Promise<void>;
  },
): UploadTransport {
  return {
    async upload(storagePath, localUri) {
      let bytes: Uint8Array;
      try {
        bytes = await files.read(localUri);
      } catch {
        return 'rejected';
      }
      try {
        const { error } = await client.storage
          .from(PHOTO_BUCKET)
          .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: false });
        return classifyUploadError(error as StorageErrorLike);
      } catch {
        return 'retry';
      }
    },

    async verify(photoId) {
      try {
        const { error } = await client.functions.invoke('verify-photo', {
          body: { photo_id: photoId },
        });
        if (!error) return 'verified';
        const context = (error as { context?: { status?: number } }).context;
        return classifyVerifyStatus(typeof context?.status === 'number' ? context.status : null);
      } catch {
        return 'retry';
      }
    },

    deleteLocal: (localUri) => files.remove(localUri),
  };
}
