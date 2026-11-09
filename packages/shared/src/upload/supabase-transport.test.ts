import { describe, expect, it } from 'vitest';
import { classifyUploadError, classifyVerifyStatus } from './supabase-transport';

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
