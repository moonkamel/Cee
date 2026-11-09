import { describe, expect, it } from 'vitest';
import {
  ALERT_KINDS,
  ALERTS,
  batchLevel,
  canMute,
  CORRECTION_SEPARATOR,
  correctionSlots,
  effectiveMuted,
  expiringQualifications,
  fitsBatch,
  isCorrectionKey,
  levelWorsened,
  matchReferences,
  normalizeEmail,
  priorityCorrections,
  referenceColumn,
} from './index';

describe('alertes', () => {
  it('seuil et contrôle sont critiques ; le dirigeant ne peut pas les couper', () => {
    expect(ALERT_KINDS.filter((k) => ALERTS[k].critical)).toEqual([
      'batch_threshold',
      'inspection_failed',
    ]);
    expect(canMute('batch_threshold', 'owner')).toBe(false);
    expect(canMute('batch_threshold', 'office')).toBe(true);
    expect(canMute('rge_expiring', 'owner')).toBe(true);
    expect(effectiveMuted(['batch_threshold', 'rge_expiring', 'inconnue'], 'owner')).toEqual([
      'rge_expiring',
    ]);
  });

  it('adresse e-mail facultative', () => {
    expect(normalizeEmail('  Tarik@Exemple.FR ')).toBe('tarik@exemple.fr');
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('pas-une-adresse')).toBe('invalid');
  });
});

describe('lots', () => {
  it('niveau : normal, à moins de 2 points, au-dessus du seuil (14 %)', () => {
    const ok = Array<'satisfactory'>(20).fill('satisfactory');
    expect(batchLevel([], 0.14)).toBe('normal');
    expect(batchLevel([...ok, 'unsatisfactory'], 0.14)).toBe('normal');
    expect(batchLevel([...ok.slice(0, 7), 'unsatisfactory'], 0.14)).toBe('near'); // 12,5 %
    expect(batchLevel([...ok.slice(0, 5), 'unsatisfactory'], 0.14)).toBe('over'); // 16,7 %
  });

  it('l’alerte ne repart que si la situation s’aggrave', () => {
    expect(levelWorsened('normal', 'near')).toBe(true);
    expect(levelWorsened('near', 'over')).toBe(true);
    expect(levelWorsened('over', 'near')).toBe(false);
    expect(levelWorsened('near', 'near')).toBe(false);
  });

  it('un chantier entre dans un lot : bonne fiche, dans la période', () => {
    const batch = { operationCode: 'BAR-TH-171', start: '2026-10-01', end: '2026-12-31' };
    expect(
      fitsBatch({ operationCodes: ['BAR-TH-171', 'BAR-EN-101'], date: '2026-11-11' }, batch),
    ).toEqual({ ok: true });
    expect(fitsBatch({ operationCodes: ['BAR-EN-101'], date: '2026-11-11' }, batch).reason).toBe(
      'pas d’opération BAR-TH-171',
    );
    expect(fitsBatch({ operationCodes: ['BAR-TH-171'], date: '2026-09-30' }, batch).reason).toBe(
      'avant la période',
    );
    expect(fitsBatch({ operationCodes: ['BAR-TH-171'], date: '2027-01-01' }, batch).reason).toBe(
      'après la période',
    );
    expect(
      fitsBatch(
        { operationCodes: ['BAR-TH-171'], date: null },
        { ...batch, start: null, end: null },
      ).ok,
    ).toBe(true);
  });

  it('import du fichier du délégataire : références de chantier ou de devis', () => {
    const jobsites = [
      { id: 'a', reference: 'CH-2026-001', quote_reference: 'DEV-2026-0147' },
      { id: 'b', reference: 'CH-2026-002', quote_reference: null },
    ];
    expect(
      matchReferences(
        [' ch-2026-001 ', 'DEV-2026-0147', 'CH-2026-002', 'X-9', 'X-9', ''],
        jobsites,
      ),
    ).toEqual({
      found: [jobsites[0], jobsites[1]],
      missing: ['X-9'],
    });
    const rows = [
      ['Bénéficiaire', 'Dossier', 'Montant'],
      ['Guérin', 'DEV-2026-0147', '4000'],
      ['Dupont', 'CH-2026-002', '1200'],
    ];
    expect(referenceColumn(rows, jobsites)).toBe(1);
  });
});

describe('contrôles et reprises', () => {
  const row = (id: string, result: 'satisfactory' | 'unsatisfactory', on: string, extra = {}) => ({
    id,
    jobsite_id: id,
    result,
    inspected_on: on,
    corrected_on: null,
    correction_planned_at: null,
    ...extra,
  });

  it('à corriger en priorité : non satisfaisants non repris, reprise non planifiée d’abord, plus anciens d’abord', () => {
    const list = priorityCorrections([
      row('a', 'unsatisfactory', '2026-10-10'),
      row('b', 'unsatisfactory', '2026-09-01', { correction_planned_at: '2026-10-01T00:00:00Z' }),
      row('c', 'satisfactory', '2026-08-01'),
      row('d', 'unsatisfactory', '2026-08-15', { corrected_on: '2026-09-01' }),
      row('e', 'unsatisfactory', '2026-10-01'),
    ]);
    expect(list.map((r) => r.id)).toEqual(['e', 'a', 'b']);
  });

  it('preuves après correction : en plus des anciennes, numérotées sans collision', () => {
    const slots = correctionSlots(
      [
        { item_key: 'outdoor_unit', instruction: 'Unité extérieure posée', operation_id: 'o' },
        { item_key: 'thickness#2', instruction: 'Épaisseur (2)', operation_id: 'o2' },
        {
          item_key: 'outdoor_unit~reprise-1',
          instruction: 'Unité extérieure posée (après correction)',
          operation_id: 'o',
        },
      ],
      ['outdoor_unit', 'outdoor_unit~reprise-1'],
    );
    expect(slots.map((s) => [s.item_key, s.instruction])).toEqual([
      ['outdoor_unit~reprise-2', 'Unité extérieure posée (après correction)'],
      ['thickness#2~reprise-1', 'Épaisseur (2) (après correction)'],
      ['outdoor_unit~reprise-3', 'Unité extérieure posée (après correction)'],
    ]);
    expect(slots.every((s) => s.phase === 'apres' && s.required)).toBe(true);
    expect(isCorrectionKey(`x${CORRECTION_SEPARATOR}1`)).toBe(true);
    expect(isCorrectionKey('x#1')).toBe(false);
  });
});

describe('RGE', () => {
  it('qualifications qui expirent dans les 60 jours', () => {
    const quals = [
      { numero: 'A', date_fin: '2026-12-31' },
      { numero: 'B', date_fin: '2027-06-30' },
      { numero: 'C', date_fin: '2026-11-01' },
      { numero: 'D' },
    ];
    expect(expiringQualifications(quals, '2026-11-09').map((q) => q.numero)).toEqual(['A']);
    expect(expiringQualifications(null, '2026-11-09')).toEqual([]);
  });
});
