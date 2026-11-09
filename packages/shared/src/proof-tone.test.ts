import { describe, expect, it } from 'vitest';
import { proofTone } from './proof-tone';
import { PROOF_SLOT_STATUSES } from './statuses';

describe('proofTone', () => {
  it('associe un ton à chaque statut de preuve', () => {
    for (const s of PROOF_SLOT_STATUSES) expect(proofTone(s)).toBeTruthy();
  });

  it('suit la section 3 : validée en vert, à reprendre en orange, manquante en rouge', () => {
    expect(proofTone('compliant')).toBe('ok');
    expect(proofTone('manually_validated')).toBe('ok');
    expect(proofTone('to_retake')).toBe('warn');
    expect(proofTone('missing')).toBe('ko');
    expect(proofTone('analyzing')).toBe('pending');
  });
});
