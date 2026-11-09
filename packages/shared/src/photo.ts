// Fiche d'une photo de chantier (section 6, « Métadonnées et valeur de preuve »).
import { distanceMeters } from './geo';
import type { Row } from './sync/types';

export type PhotoSource = 'camera' | 'gallery_import';

export type PhotoCapture = {
  id: string;
  companyId: string;
  jobsiteId: string;
  authorId: string;
  /** Emplacement de preuve rempli, ou null pour une photo libre (« Divers »). */
  proofSlotId: string | null;
  /** Heure de l'appareil au déclenchement (ISO). L'heure serveur est ajoutée à la réception. */
  takenAt: string;
  position: { lat: number; lng: number; accuracyM: number | null } | null;
  headingDeg: number | null;
  deviceModel: string | null;
  appVersion: string | null;
  /** Empreinte SHA-256 du fichier original, calculée sur le téléphone. */
  sha256: string;
  source: PhotoSource;
  width: number | null;
  height: number | null;
};

export class PhotoError extends Error {}

/** Chemin du fichier dans le stockage : rangé sous le dossier de l'entreprise (RLS du stockage). */
export function photoStoragePath(companyId: string, jobsiteId: string, photoId: string): string {
  return `${companyId}/${jobsiteId}/${photoId}.jpg`;
}

/** Hors du rayon du chantier : badge « hors chantier », jamais de blocage. */
export function isOutsideGeofence(
  position: { lat: number; lng: number } | null,
  jobsite: { lat: number | null; lng: number | null; geofenceRadiusM: number },
): boolean {
  if (!position || jobsite.lat === null || jobsite.lng === null) return false;
  return distanceMeters(position, { lat: jobsite.lat, lng: jobsite.lng }) > jobsite.geofenceRadiusM;
}

/** Écart de plus de 10 minutes entre l'heure de l'appareil et l'heure serveur : à signaler. */
export function isClockSkewed(deviceIso: string, serverIso: string, maxMinutes = 10): boolean {
  return Math.abs(Date.parse(deviceIso) - Date.parse(serverIso)) > maxMinutes * 60_000;
}

/**
 * Ligne `photos` à synchroniser. Une image importée de la galerie ne compte jamais comme
 * preuve (section 6) : elle reste une photo libre, quelle que soit la demande.
 */
export function buildPhotoRow(
  capture: PhotoCapture,
  jobsite: { lat: number | null; lng: number | null; geofenceRadiusM: number },
): Row {
  if (!/^[0-9a-f]{64}$/.test(capture.sha256)) throw new PhotoError('Empreinte SHA-256 invalide');
  if (Number.isNaN(Date.parse(capture.takenAt)))
    throw new PhotoError('Heure de prise de vue invalide');
  const proofSlotId = capture.source === 'camera' ? capture.proofSlotId : null;
  return {
    id: capture.id,
    jobsite_id: capture.jobsiteId,
    proof_slot_id: proofSlotId,
    author_id: capture.authorId,
    device_taken_at: capture.takenAt,
    lat: capture.position?.lat ?? null,
    lng: capture.position?.lng ?? null,
    gps_accuracy_m: capture.position?.accuracyM ?? null,
    heading: capture.headingDeg,
    device_model: capture.deviceModel,
    app_version: capture.appVersion,
    sha256: capture.sha256,
    original_path: photoStoragePath(capture.companyId, capture.jobsiteId, capture.id),
    source: capture.source,
    outside_geofence: isOutsideGeofence(capture.position, jobsite),
    upload_status: 'pending',
    exif: capture.width && capture.height ? { width: capture.width, height: capture.height } : null,
  };
}
