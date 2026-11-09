import { describe, expect, it } from 'vitest';
import { formatFrenchPhone, normalizeFrenchPhone } from './phone';
import { proofProgress } from './proof-progress';

describe('normalizeFrenchPhone', () => {
  it.each([
    ['06 39 98 00 03', '+33639980003'],
    ['06.39.98.00.03', '+33639980003'],
    ['+33 6 39 98 00 03', '+33639980003'],
    ['0033639980003', '+33639980003'],
    ['0472000000', '+33472000000'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeFrenchPhone(input)).toBe(expected);
  });

  it.each(['', '0639', '00639980003', '+44 7700 900123', '06 39 98 00 03 1'])(
    'refuse %s',
    (input) => {
      expect(normalizeFrenchPhone(input)).toBeNull();
    },
  );

  it('affiche le numéro au format national', () => {
    expect(formatFrenchPhone('+33639980003')).toBe('06 39 98 00 03');
    expect(formatFrenchPhone('inconnu')).toBe('inconnu');
  });
});

describe('proofProgress', () => {
  it('compte les preuves obligatoires prises, pas celles à reprendre ni les facultatives', () => {
    expect(
      proofProgress([
        { status: 'compliant', required: true },
        { status: 'captured', required: true },
        { status: 'to_retake', required: true },
        { status: 'missing', required: true },
        { status: 'compliant', required: false },
      ]),
    ).toEqual({ done: 2, total: 4 });
  });

  it('vaut 0 sur 0 sans preuve attendue', () => {
    expect(proofProgress([])).toEqual({ done: 0, total: 0 });
  });
});
