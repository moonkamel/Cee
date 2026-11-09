import { describe, expect, it } from 'vitest';
import {
  PhotoError,
  buildPhotoRow,
  isClockSkewed,
  isOutsideGeofence,
  photoStoragePath,
  type PhotoCapture,
} from './photo';
import { nextSlot, orderSlots, slotRank, type SlotLike } from './slots';

const SITE = { lat: 45.738, lng: 4.913, geofenceRadiusM: 150 };
const capture = (over: Partial<PhotoCapture> = {}): PhotoCapture => ({
  id: 'p1',
  companyId: 'c1',
  jobsiteId: 'j1',
  authorId: 'u1',
  proofSlotId: 's1',
  takenAt: '2026-11-09T09:15:00.000Z',
  position: { lat: 45.738, lng: 4.913, accuracyM: 6 },
  headingDeg: 182,
  deviceModel: 'Pixel 6a',
  appVersion: '1.0.0',
  sha256: 'a'.repeat(64),
  source: 'camera',
  width: 4000,
  height: 3000,
  ...over,
});

describe('buildPhotoRow', () => {
  it('rassemble toutes les métadonnées de preuve de la section 6', () => {
    expect(buildPhotoRow(capture(), SITE)).toMatchObject({
      id: 'p1',
      jobsite_id: 'j1',
      proof_slot_id: 's1',
      author_id: 'u1',
      device_taken_at: '2026-11-09T09:15:00.000Z',
      lat: 45.738,
      lng: 4.913,
      gps_accuracy_m: 6,
      heading: 182,
      device_model: 'Pixel 6a',
      app_version: '1.0.0',
      sha256: 'a'.repeat(64),
      original_path: 'c1/j1/p1.jpg',
      source: 'camera',
      outside_geofence: false,
      upload_status: 'pending',
      exif: { width: 4000, height: 3000 },
    });
  });

  it('n’envoie jamais l’entreprise ni l’heure serveur : le serveur les impose', () => {
    const row = buildPhotoRow(capture(), SITE);
    expect(row).not.toHaveProperty('company_id');
    expect(row).not.toHaveProperty('server_received_at');
  });

  it('une image de la galerie ne remplit jamais un emplacement de preuve', () => {
    const row = buildPhotoRow(capture({ source: 'gallery_import', proofSlotId: 's1' }), SITE);
    expect(row).toMatchObject({ source: 'gallery_import', proof_slot_id: null });
  });

  it('refuse une empreinte ou une heure invalide', () => {
    expect(() => buildPhotoRow(capture({ sha256: 'abc' }), SITE)).toThrow(PhotoError);
    expect(() => buildPhotoRow(capture({ takenAt: 'hier' }), SITE)).toThrow(PhotoError);
  });

  it('garde une photo sans GPS, sans la marquer hors chantier', () => {
    expect(buildPhotoRow(capture({ position: null }), SITE)).toMatchObject({
      lat: null,
      outside_geofence: false,
    });
  });
});

describe('métadonnées', () => {
  it('range le fichier sous le dossier de l’entreprise', () => {
    expect(photoStoragePath('c1', 'j1', 'p1')).toBe('c1/j1/p1.jpg');
  });

  it('marque « hors chantier » au-delà du rayon, jamais sans position', () => {
    expect(isOutsideGeofence({ lat: 45.7381, lng: 4.913 }, SITE)).toBe(false);
    expect(isOutsideGeofence({ lat: 45.764, lng: 4.8357 }, SITE)).toBe(true);
    expect(isOutsideGeofence(null, SITE)).toBe(false);
    expect(
      isOutsideGeofence({ lat: 45, lng: 4 }, { lat: null, lng: null, geofenceRadiusM: 150 }),
    ).toBe(false);
  });

  it('signale un écart d’horloge de plus de 10 minutes', () => {
    expect(isClockSkewed('2026-11-09T09:00:00Z', '2026-11-09T09:09:00Z')).toBe(false);
    expect(isClockSkewed('2026-11-09T09:00:00Z', '2026-11-09T09:11:00Z')).toBe(true);
    expect(isClockSkewed('2026-11-09T09:11:00Z', '2026-11-09T09:00:00Z')).toBe(true);
  });
});

describe('ordre des preuves', () => {
  const slots: SlotLike[] = [
    { id: 'plaque', phase: 'apres', position: 3, required: true, status: 'missing' },
    { id: 'chaudiere', phase: 'avant', position: 1, required: true, status: 'captured' },
    { id: 'option', phase: 'apres', position: 9, required: false, status: 'missing' },
    { id: 'unite', phase: 'apres', position: 2, required: true, status: 'to_retake' },
    { id: 'pendant', phase: 'pendant', position: 1, required: true, status: 'compliant' },
  ];

  it('suit l’ordre avant, pendant, après puis celui du modèle', () => {
    expect(orderSlots(slots).map((s) => s.id)).toEqual([
      'chaudiere',
      'pendant',
      'unite',
      'plaque',
      'option',
    ]);
  });

  it('propose la prochaine preuve à prendre, à reprendre comprise', () => {
    expect(nextSlot(slots)?.id).toBe('unite');
    expect(nextSlot(slots, 'unite')?.id).toBe('plaque');
  });

  it('repart du début après la dernière, et finit par les facultatives', () => {
    expect(nextSlot(slots, 'plaque')?.id).toBe('unite');
    const onlyOptional = slots.map((s) =>
      s.required ? { ...s, status: 'compliant' as const } : s,
    );
    expect(nextSlot(onlyOptional)?.id).toBe('option');
  });

  it('renvoie null quand tout est pris', () => {
    expect(nextSlot(slots.map((s) => ({ ...s, status: 'captured' as const })))).toBeNull();
  });

  it('donne le rang « Photo 3 sur 5 »', () => {
    expect(slotRank(slots, 'unite')).toEqual({ rank: 3, total: 5 });
  });
});
