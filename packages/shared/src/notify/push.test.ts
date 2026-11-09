import { describe, expect, it } from 'vitest';
import { deepLink, expoMessages, isQuietHours, parisHour, shouldSendNow } from './push';

describe('heures calmes (20 h – 7 h, heure de Paris)', () => {
  it('suit l’heure de Paris, été comme hiver', () => {
    expect(parisHour('2026-11-09T19:30:00Z')).toBe(20); // hiver : UTC+1
    expect(parisHour('2026-07-09T18:30:00Z')).toBe(20); // été : UTC+2
    expect(isQuietHours('2026-11-09T19:30:00Z')).toBe(true);
    expect(isQuietHours('2026-11-09T05:59:00Z')).toBe(true); // 6 h 59
    expect(isQuietHours('2026-11-09T06:00:00Z')).toBe(false); // 7 h
    expect(isQuietHours('2026-11-09T12:00:00Z')).toBe(false);
  });

  it('seules les alertes de seuil et de contrôle passent la nuit', () => {
    const night = '2026-11-09T22:00:00Z';
    expect(shouldSendNow('photo_request', night)).toBe(false);
    expect(shouldSendNow('batch_threshold', night)).toBe(true);
    expect(shouldSendNow('photo_request', '2026-11-09T09:00:00Z')).toBe(true);
  });
});

describe('message push', () => {
  const n = {
    id: 'n1',
    kind: 'photo_request',
    payload: {
      title: 'Photo à reprendre',
      body: 'Plaque illisible',
      jobsite_id: 'j1',
      proof_slot_id: 's1',
    },
  };

  it('ouvre la caméra sur la bonne consigne', () => {
    expect(deepLink(n)).toBe('preuvio://jobsite/j1/camera?slot=s1');
    expect(deepLink({ id: 'x', kind: 'other', payload: { jobsite_id: 'j1' } })).toBe(
      'preuvio://jobsite/j1',
    );
    expect(deepLink({ id: 'x', kind: 'other', payload: {} })).toBe('preuvio://');
  });

  it('un message par appareil', () => {
    expect(expoMessages(n, ['A', 'B'])).toEqual([
      expect.objectContaining({
        to: 'A',
        title: 'Photo à reprendre',
        body: 'Plaque illisible',
        data: { url: 'preuvio://jobsite/j1/camera?slot=s1', notificationId: 'n1' },
      }),
      expect.objectContaining({ to: 'B' }),
    ]);
    expect(expoMessages({ id: 'x', kind: 'k', payload: {} }, ['A'])[0]).toMatchObject({
      title: 'Preuvio',
      body: '',
    });
  });
});
