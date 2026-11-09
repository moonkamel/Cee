// Note vocale enregistrée sur le téléphone (section 9) : ligne voice_notes à synchroniser.
import type { Row } from './sync/types';

/** Durée maximale d'une note (section 9) : l'enregistrement s'arrête seul. */
export const MAX_VOICE_SECONDS = 120;

export class VoiceNoteError extends Error {}

/** Chemin de l'audio dans le stockage : rangé sous le dossier de l'entreprise (RLS). */
export function voiceStoragePath(companyId: string, jobsiteId: string, noteId: string): string {
  return `${companyId}/${jobsiteId}/${noteId}.m4a`;
}

export function buildVoiceNoteRow(note: {
  id: string;
  companyId: string;
  jobsiteId: string;
  authorId: string;
  photoId: string | null;
  durationS: number;
}): Row {
  if (!(note.durationS > 0)) throw new VoiceNoteError('Note vide');
  return {
    id: note.id,
    jobsite_id: note.jobsiteId,
    photo_id: note.photoId,
    author_id: note.authorId,
    audio_path: voiceStoragePath(note.companyId, note.jobsiteId, note.id),
    // Un enregistrement arrêté à la limite peut dépasser de quelques millisecondes.
    duration_s: Math.min(MAX_VOICE_SECONDS, Math.round(note.durationS * 10) / 10),
    upload_status: 'pending',
  };
}
