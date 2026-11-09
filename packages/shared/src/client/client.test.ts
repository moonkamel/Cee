import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  extendedExpiry,
  galleries,
  maskPhone,
  newLinkToken,
  newSmsCode,
  offerReview,
  pvContent,
} from './index';

describe('liens et codes', () => {
  it('jeton de 32 octets en base64url, différent à chaque fois', () => {
    const t = newLinkToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newLinkToken()).not.toBe(t);
    expect(newLinkToken((b) => b.fill(255))).toBe('_'.repeat(42) + '8');
  });

  it('code SMS à 6 chiffres', () => {
    expect(newSmsCode()).toMatch(/^\d{6}$/);
    expect(newSmsCode((b) => b.fill(42))).toBe('000042');
  });

  it('prolongation de 90 jours à partir de la plus tardive des deux dates', () => {
    expect(extendedExpiry('2026-12-01T00:00:00.000Z', '2026-11-09T00:00:00.000Z')).toBe(
      '2027-03-01T00:00:00.000Z',
    );
    expect(extendedExpiry('2026-01-01T00:00:00.000Z', '2026-11-09T00:00:00.000Z')).toBe(
      '2027-02-07T00:00:00.000Z',
    );
  });

  it('numéro masqué', () => {
    expect(maskPhone('+33639980110')).toBe('06 39 98 •• 10');
    expect(maskPhone('12')).toBe('');
  });
});

describe('galeries', () => {
  it('avant, pendant, après, puis les autres ; galeries vides absentes', () => {
    const g = galleries([
      { id: 'c', phase: 'apres', taken_at: '3' },
      { id: 'a', phase: 'avant', taken_at: '2' },
      { id: 'b', phase: 'avant', taken_at: '1' },
      { id: 'd', phase: 'inconnue', taken_at: '4' },
    ]);
    expect(g.map((x) => [x.phase, x.photos.map((p) => p.id)])).toEqual([
      ['avant', ['b', 'a']],
      ['apres', ['c']],
      ['divers', ['d']],
    ]);
  });
});

describe('PV de réception', () => {
  const base = {
    company: {
      name: 'Proofeo',
      siret: '12345678900011',
      rge: [{ organisme: 'Qualit’EnR', numero: 'QPAC/1' }, {}],
    },
    client: 'M. et Mme Guérin',
    address: '14 Rue des Ajoncs 44400 Rezé',
    reference: 'CH-2026-001',
    operations: ['Pompe à chaleur air/eau'],
    reserves: '  ',
    signer: ' Marc Guérin ',
    signedAt: '2026-11-11T16:00:00Z',
    marketingConsent: false,
    smsVerified: true,
  };

  it('sans réserve', () => {
    const pv = pvContent(base);
    expect(pv.declaration).toContain('sans réserve');
    expect(pv.reserves).toBeNull();
    expect(pv.signer).toBe('Marc Guérin');
    expect(pv.company.rge).toEqual(['Qualit’EnR QPAC/1']);
  });

  it('avec réserves ; client absent : le signataire', () => {
    const pv = pvContent({ ...base, reserves: ' Habillage à finir ', client: null });
    expect(pv.declaration).toContain('avec les réserves');
    expect(pv.reserves).toBe('Habillage à finir');
    expect(pv.client).toBe('Marc Guérin');
  });

  it('empreinte stable : l’ordre des clés ne change rien', () => {
    expect(canonicalJson({ b: 1, a: [{ d: null, c: 'x' }], u: undefined })).toBe(
      '{"a":[{"c":"x","d":null}],"b":1}',
    );
    expect(canonicalJson(pvContent(base))).toBe(canonicalJson({ ...pvContent(base) }));
  });

  it('avis Google : PV sans réserve et lien fourni seulement', () => {
    expect(offerReview({ has_reserves: false }, 'https://g.page/r/x')).toBe(true);
    expect(offerReview({ has_reserves: true }, 'https://g.page/r/x')).toBe(false);
    expect(offerReview({ has_reserves: false }, null)).toBe(false);
    expect(offerReview(null, 'https://g.page/r/x')).toBe(false);
  });
});
