import { describe, expect, it } from 'vitest';
import { distanceMeters, isWithinRadius } from './geo';
import {
  featuredJobsite,
  isTodayJobsite,
  selectTodayJobsites,
  type TodayJobsiteInput,
} from './today';

const site = (over: Partial<TodayJobsiteInput> & { id: string }): TodayJobsiteInput => ({
  status: 'planned',
  plannedStart: '2026-11-09',
  plannedEnd: '2026-11-09',
  lat: null,
  lng: null,
  geofenceRadiusM: 150,
  ...over,
});

const LYON = { lat: 45.764, lng: 4.8357 };
const BRON = { lat: 45.738, lng: 4.913 };

describe('distanceMeters', () => {
  it('Lyon centre → Bron : environ 6,7 km', () => {
    expect(distanceMeters(LYON, BRON)).toBeGreaterThan(6_500);
    expect(distanceMeters(LYON, BRON)).toBeLessThan(7_000);
  });

  it('vaut 0 au même point et respecte le rayon', () => {
    expect(distanceMeters(LYON, LYON)).toBe(0);
    expect(isWithinRadius({ lat: 45.7641, lng: 4.8357 }, LYON, 150)).toBe(true);
    expect(isWithinRadius(BRON, LYON, 150)).toBe(false);
  });
});

describe('isTodayJobsite', () => {
  const today = '2026-11-09';
  it('retient un chantier en cours, quelles que soient ses dates', () => {
    expect(
      isTodayJobsite(site({ id: 'a', status: 'in_progress', plannedStart: '2026-10-01' }), today),
    ).toBe(true);
  });
  it('retient un chantier planifié sur plusieurs jours qui inclut aujourd’hui', () => {
    expect(
      isTodayJobsite(
        site({ id: 'a', plannedStart: '2026-11-08', plannedEnd: '2026-11-10' }),
        today,
      ),
    ).toBe(true);
  });
  it('écarte un chantier d’un autre jour, sans date ou déjà terminé', () => {
    expect(
      isTodayJobsite(site({ id: 'a', plannedStart: '2026-11-10', plannedEnd: null }), today),
    ).toBe(false);
    expect(isTodayJobsite(site({ id: 'a', plannedStart: null }), today)).toBe(false);
    expect(isTodayJobsite(site({ id: 'a', status: 'completed_by_installer' }), today)).toBe(false);
  });
});

describe('selectTodayJobsites', () => {
  const today = '2026-11-09';
  const list = [
    site({ id: 'loin', lat: BRON.lat, lng: BRON.lng }),
    site({ id: 'sans-gps' }),
    site({ id: 'ici', lat: 45.7641, lng: 4.8357 }),
    site({ id: 'demain', plannedStart: '2026-11-10', plannedEnd: null }),
  ];

  it('met le plus proche en tête, les chantiers sans GPS à la fin', () => {
    expect(selectTodayJobsites(list, today, LYON).map((j) => j.id)).toEqual([
      'ici',
      'loin',
      'sans-gps',
    ]);
  });

  it('sans position, garde un ordre stable par date puis identifiant', () => {
    const result = selectTodayJobsites(list, today, null);
    expect(result.map((j) => j.id)).toEqual(['ici', 'loin', 'sans-gps']);
    expect(result.every((j) => j.distanceM === null && !j.insideGeofence)).toBe(true);
  });

  it('signale le chantier dans le rayon et le met en avant', () => {
    const result = selectTodayJobsites(list, today, LYON);
    expect(result[0]?.insideGeofence).toBe(true);
    expect(featuredJobsite(result)?.id).toBe('ici');
  });

  it('met en avant le seul chantier du jour, même hors du rayon', () => {
    const result = selectTodayJobsites([site({ id: 'seul' })], today, null);
    expect(featuredJobsite(result)?.id).toBe('seul');
  });

  it('ne met rien en avant parmi plusieurs chantiers hors du rayon', () => {
    expect(featuredJobsite(selectTodayJobsites(list, today, null))).toBeNull();
  });
});
