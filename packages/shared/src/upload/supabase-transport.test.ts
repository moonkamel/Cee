import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  classifyUploadError,
  classifyVerifyStatus,
  createSupabaseUploadTransport,
  createSupabaseVoiceTransport,
  type UploadErrorStage,
} from './supabase-transport';

describe('réponses du stockage', () => {
  it('fichier déjà présent : compté comme envoyé', () => {
    expect(classifyUploadError({ statusCode: '409', message: 'The resource already exists' })).toBe(
      'exists',
    );
    expect(classifyUploadError({ status: 400, message: 'Duplicate' })).toBe('exists');
  });
  it('refus définitifs et erreurs passagères', () => {
    expect(classifyUploadError(null)).toBe('ok');
    expect(classifyUploadError({ statusCode: '403', message: 'row-level security' })).toBe(
      'rejected',
    );
    expect(classifyUploadError({ statusCode: '413', message: 'Payload too large' })).toBe(
      'rejected',
    );
    expect(classifyUploadError({ statusCode: '400', message: 'jwt expired' })).toBe('retry');
    expect(classifyUploadError({ status: 503, message: 'unavailable' })).toBe('retry');
    expect(classifyUploadError({ message: 'Network request failed' })).toBe('retry');
  });
});

describe('réponses de verify-photo', () => {
  it('traduit le statut HTTP', () => {
    expect(classifyVerifyStatus(200)).toBe('verified');
    expect(classifyVerifyStatus(409)).toBe('mismatch');
    expect(classifyVerifyStatus(404)).toBe('missing');
    expect(classifyVerifyStatus(401)).toBe('retry');
    expect(classifyVerifyStatus(500)).toBe('retry');
    expect(classifyVerifyStatus(null)).toBe('retry');
  });
});

describe('erreurs signalées au suivi', () => {
  function fakeClient(upload: () => Promise<{ error: unknown }>, invoke = upload) {
    return {
      storage: { from: () => ({ upload }) },
      functions: { invoke },
    } as unknown as SupabaseClient;
  }
  const files = (read: () => Promise<Uint8Array>) => ({ read, remove: async () => undefined });

  it('fichier illisible : refusé, étape « read »', async () => {
    const seen: UploadErrorStage[] = [];
    const t = createSupabaseUploadTransport(
      fakeClient(async () => ({ error: null })),
      files(async () => {
        throw new Error('java.lang.RuntimeException');
      }),
      (stage) => seen.push(stage),
    );
    expect(await t.upload('c/j/p.jpg', 'file:///p.jpg')).toBe('rejected');
    expect(seen).toEqual(['read']);
  });

  it('réseau coupé ou refus du stockage : étape « upload »', async () => {
    const seen: UploadErrorStage[] = [];
    const t = createSupabaseVoiceTransport(
      fakeClient(async () => {
        throw new Error('Network request failed');
      }),
      files(async () => new Uint8Array([1])),
      (stage) => seen.push(stage),
    );
    expect(await t.upload('c/j/n.m4a', 'file:///n.m4a')).toBe('retry');
    const refused = createSupabaseUploadTransport(
      fakeClient(async () => ({ error: { statusCode: '403', message: 'row-level security' } })),
      files(async () => new Uint8Array([1])),
      (stage) => seen.push(stage),
    );
    expect(await refused.upload('c/j/p.jpg', 'file:///p.jpg')).toBe('rejected');
    expect(seen).toEqual(['upload', 'upload']);
  });

  it('fichier déjà présent ou vérifié : rien à signaler', async () => {
    const seen: UploadErrorStage[] = [];
    const t = createSupabaseUploadTransport(
      fakeClient(
        async () => ({ error: { statusCode: '409', message: 'already exists' } }),
        async () => ({ error: null }),
      ),
      files(async () => new Uint8Array([1])),
      (stage) => seen.push(stage),
    );
    expect(await t.upload('c/j/p.jpg', 'file:///p.jpg')).toBe('exists');
    expect(await t.verify('p')).toBe('verified');
    expect(seen).toEqual([]);
  });

  it('vérification impossible : étape « verify »', async () => {
    const seen: UploadErrorStage[] = [];
    const t = createSupabaseUploadTransport(
      fakeClient(
        async () => ({ error: null }),
        async () => ({ error: { context: { status: 500 } } }),
      ),
      files(async () => new Uint8Array([1])),
      (stage) => seen.push(stage),
    );
    expect(await t.verify('p')).toBe('retry');
    expect(seen).toEqual(['verify']);
  });
});
