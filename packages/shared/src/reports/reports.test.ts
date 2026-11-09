import { describe, expect, it } from 'vitest';
import {
  applyEdits,
  chunk,
  contentChanged,
  formatParis,
  latestVersions,
  parseContent,
  photoNumbers,
  REPORT_TITLES,
  type ReportContent,
  reportFileName,
  SECTION_TITLES,
  sha256Hex,
} from './index';

const content: ReportContent = {
  kind: 'completion',
  period: null,
  photo_ids: ['a', 'b'],
  note_ids: ['n'],
  sections: {
    summary: [{ text: 'PAC posée.', photo_ids: ['b'], note_ids: [] }],
    works: [
      { text: 'Chaudière déposée.', photo_ids: ['a'], note_ids: [] },
      { text: 'Combles soufflés.', photo_ids: ['b'], note_ids: ['n'] },
    ],
    reserves: [],
    attention: [],
  },
  written_by: 'claude-sonnet-5-5',
  dropped: 0,
};

describe('grille du PDF', () => {
  it('pages de 2 × 3 photos', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7]).map((p) => p.length)).toEqual([6, 1]);
    expect(chunk([])).toEqual([]);
    expect(() => chunk([1], 0)).toThrow();
  });

  it('numéros des photos citées', () => {
    expect(photoNumbers(['c', 'b', 'x'], ['a', 'b', 'c'])).toEqual([2, 3]);
  });
});

describe('dates à l’heure de Paris', () => {
  it('hiver et été', () => {
    expect(formatParis('2026-11-09T15:10:00Z')).toBe('09/11/2026 16:10');
    expect(formatParis('2026-07-01T15:10:00Z')).toBe('01/07/2026 17:10');
    expect(formatParis('2026-11-09T23:30:00Z', false)).toBe('10/11/2026');
    expect(formatParis('pas une date')).toBe('');
  });
});

describe('relecture par le bureau', () => {
  it('modifie, retire et ajoute des phrases ; les justifications restent', () => {
    const next = applyEdits(content, {
      texts: { works: ['Chaudière fioul déposée.', '  '] },
      added: { reserves: 'Trappe à recaler\n\n  Habillage à finir ' },
    });
    expect(next.sections.works).toEqual([
      { text: 'Chaudière fioul déposée.', photo_ids: ['a'], note_ids: [] },
    ]);
    expect(next.sections.reserves.map((s) => s.text)).toEqual([
      'Trappe à recaler',
      'Habillage à finir',
    ]);
    expect(next.sections.summary).toEqual(content.sections.summary);
    expect(next.written_by).toBe('bureau');
    expect(contentChanged(content, next)).toBe(true);
    expect(contentChanged(content, applyEdits(content, { texts: {} }))).toBe(false);
  });

  it('contenu abîmé : rapport vide, pas d’erreur', () => {
    expect(parseContent(content, 'completion')).toEqual(content);
    const broken = parseContent({ nope: true }, 'daily');
    expect(broken.written_by).toBe('illisible');
    expect(broken.kind).toBe('daily');
  });
});

describe('versions et fichiers', () => {
  it('dernière version de chaque série, la plus récente d’abord', () => {
    const rows = [
      {
        id: '1',
        series_id: 's1',
        version: 1,
        kind: 'completion' as const,
        created_at: '2026-11-09T10:00',
      },
      {
        id: '2',
        series_id: 's1',
        version: 2,
        kind: 'completion' as const,
        created_at: '2026-11-09T11:00',
      },
      {
        id: '3',
        series_id: 's2',
        version: 1,
        kind: 'daily' as const,
        created_at: '2026-11-09T17:00',
      },
    ];
    expect(latestVersions(rows).map((r) => r.id)).toEqual(['3', '2']);
  });

  it('nom de fichier et titres', () => {
    expect(reportFileName('CH-2026-001', 'completion', 2)).toBe('CH-2026-001_completion_v2.pdf');
    expect(reportFileName(null, 'dispute', 1)).toBe('chantier_dispute_v1.pdf');
    expect(reportFileName('A/B C', 'daily', 1)).toBe('A_B_C_daily_v1.pdf');
    expect(REPORT_TITLES.dispute).toBe('Dossier de litige');
    expect(SECTION_TITLES.attention).toBe('Points d’attention');
  });

  it('empreinte SHA-256', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('données du chantier dans le PDF', () => {
  it('équipements lus sur les plaques, sans doublon', async () => {
    const { equipmentFrom } = await import('./index');
    const plate = {
      verdict: { extracted: { brand: 'Atlantic', model: 'Alféa', serial_number: 'SN1' } },
    };
    expect(
      equipmentFrom([
        { label: 'Plaque extérieure', ai_result: plate },
        { label: 'Plaque bis', ai_result: plate },
        { label: 'Façade', ai_result: { verdict: { extracted: { brand: null } } } },
        { label: 'Pas analysée', ai_result: null },
      ]),
    ).toEqual([
      { label: 'Plaque extérieure', brand: 'Atlantic', model: 'Alféa', serialNumber: 'SN1' },
    ]);
  });

  it('preuves obligatoires manquantes, dans l’ordre conseillé', async () => {
    const { missingProofs } = await import('./index');
    const s = { required: true, applicable: true, status: 'missing', phase: 'apres', position: 0 };
    expect(
      missingProofs([
        { ...s, instruction: 'Régulateur', position: 900 },
        { ...s, instruction: 'Façade', phase: 'avant' },
        { ...s, instruction: 'Plaque', status: 'to_retake', position: 600 },
        { ...s, instruction: 'Prise', status: 'compliant' },
        { ...s, instruction: 'Facultative', required: false },
        { ...s, instruction: 'Masquée', applicable: false },
      ]),
    ).toEqual(['Façade', 'Plaque', 'Régulateur']);
  });
});
