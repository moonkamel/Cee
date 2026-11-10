import { describe, expect, it, vi } from 'vitest';
import {
  EVENTS,
  healthStatus,
  parseDsn,
  posthogBatch,
  reportError,
  safeProps,
  sendEvents,
  sentryEnvelope,
} from '.';

describe('événements PostHog', () => {
  it('les 8 événements de la section 17', () => {
    expect(EVENTS).toEqual(
      expect.arrayContaining([
        'app_open',
        'jobsite_started',
        'photo_taken',
        'ai_verdict',
        'slot_completed',
        'jobsite_completed',
        'export_created',
        'pv_signed',
      ]),
    );
  });

  it('aucune donnée personnelle, pas de profil de personne', () => {
    expect(safeProps({ ms: 120, client_name: 'Guérin', address: 'x', phase: 'avant' })).toEqual({
      ms: 120,
      phase: 'avant',
    });
    const body = posthogBatch('phc_x', [
      {
        event: 'photo_taken',
        distinctId: 'u1',
        properties: { phone: '06', ok: true },
        timestamp: 't',
      },
    ]);
    expect(body).toEqual({
      api_key: 'phc_x',
      batch: [
        {
          event: 'photo_taken',
          distinct_id: 'u1',
          timestamp: 't',
          properties: { ok: true, $process_person_profile: false },
        },
      ],
    });
  });

  it('envoi au mieux, rien sans clé', async () => {
    const ok = vi.fn(async () => new Response('{}', { status: 200 }));
    expect(await sendEvents('k', [{ event: 'app_open', distinctId: 'u' }], ok as never)).toBe(true);
    expect(String((ok.mock.calls[0] as unknown[])[0])).toBe('https://eu.i.posthog.com/batch/');
    expect(await sendEvents(null, [{ event: 'app_open', distinctId: 'u' }], ok as never)).toBe(
      false,
    );
    expect(await sendEvents('k', [], ok as never)).toBe(false);
    const down = vi.fn(async () => {
      throw new Error('réseau');
    });
    expect(await sendEvents('k', [{ event: 'app_open', distinctId: 'u' }], down as never)).toBe(
      false,
    );
  });
});

describe('erreurs Sentry', () => {
  it('DSN → adresse des enveloppes', () => {
    expect(parseDsn('https://abc123@o1.ingest.de.sentry.io/456')).toEqual({
      endpoint: 'https://o1.ingest.de.sentry.io/api/456/envelope/',
      publicKey: 'abc123',
    });
    expect(parseDsn('pas un dsn')).toBeNull();
    expect(parseDsn(undefined)).toBeNull();
  });

  it('enveloppe : en-tête, élément, événement avec la pile', () => {
    const [head, item, event] = sentryEnvelope(
      {
        message: 'TypeError: x is undefined',
        stack: 'at a\nat b',
        platform: 'javascript',
        userId: 'u1',
        tags: { app: 'mobile' },
      },
      new Date('2026-11-10T10:00:00Z'),
    ).split('\n');
    expect(JSON.parse(head!).sent_at).toBe('2026-11-10T10:00:00.000Z');
    expect(JSON.parse(item!)).toEqual({ type: 'event' });
    const e = JSON.parse(event!);
    expect(e.exception.values[0].type).toBe('TypeError');
    expect(e.exception.values[0].stacktrace.frames).toEqual([
      { function: 'at b' },
      { function: 'at a' },
    ]);
    expect(e.user).toEqual({ id: 'u1' });
    expect(
      JSON.parse(sentryEnvelope({ message: 'boum', platform: 'node' }).split('\n')[2]!).exception
        .values[0].stacktrace,
    ).toBeUndefined();
  });

  it('envoi au mieux', async () => {
    const ok = vi.fn(async () => new Response('', { status: 200 }));
    expect(
      await reportError('https://k@h.io/1', { message: 'x', platform: 'node' }, ok as never),
    ).toBe(true);
    expect(await reportError(null, { message: 'x', platform: 'node' }, ok as never)).toBe(false);
    const down = vi.fn(async () => {
      throw new Error('réseau');
    });
    expect(
      await reportError('https://k@h.io/1', { message: 'x', platform: 'node' }, down as never),
    ).toBe(false);
  });
});

describe('santé du service', () => {
  it('alerte quand l’analyse IA a plus de 5 minutes de retard', () => {
    expect(
      healthStatus({
        photo_analysis: { waiting: 2, oldest_s: 40 },
        report_generation: { waiting: 1, oldest_s: 900 },
      }),
    ).toEqual({ ok: true, alerts: [] });
    expect(healthStatus({ photo_analysis: { waiting: 30, oldest_s: 420 } })).toEqual({
      ok: false,
      alerts: ['photo_analysis : 7 min de retard'],
    });
    expect(healthStatus({ photo_analysis: { waiting: 0, oldest_s: null } }).ok).toBe(true);
  });
});
