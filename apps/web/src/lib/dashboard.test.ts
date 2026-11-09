import { describe, expect, it } from 'vitest';
import {
  filterJobsites,
  jobsiteView,
  latestPhoto,
  tiles,
  todoItems,
  type JobsiteRow,
  type SlotRow,
} from './dashboard';

const slot = (id: string, status: SlotRow['status'], more: Partial<SlotRow> = {}): SlotRow => ({
  id,
  instruction: `Preuve ${id}`,
  status,
  required: true,
  applicable: true,
  waiver_reason: null,
  waiver_validated_at: null,
  updated_at: '2026-11-09T08:00:00Z',
  photos: [],
  ...more,
});

const jobsite = (id: string, slots: SlotRow[], more: Partial<JobsiteRow> = {}): JobsiteRow => ({
  id,
  address: `Chantier ${id}`,
  reference: null,
  status: 'in_progress',
  planned_start: '2026-11-09',
  planned_end: null,
  lat: 45.7,
  lng: 4.9,
  updated_at: '2026-11-09T07:00:00Z',
  clients: { full_name: 'M. Martin' },
  jobsite_assignees: [{ profile_id: 'p', profiles: { full_name: 'Jean' } }],
  proof_slots: slots,
  ...more,
});

const orange = slot('o', 'to_retake', {
  updated_at: '2026-11-08T08:00:00Z',
  photos: [
    {
      id: 'old',
      original_path: 'a',
      device_taken_at: '2026-11-08T07:00:00Z',
      author_id: 'p',
      ai_result: { decision: { kind: 'retake', message: 'Ancien' } },
      ai_kept_at: null,
      deleted_at: null,
    },
    {
      id: 'new',
      original_path: 'b',
      device_taken_at: '2026-11-08T08:00:00Z',
      author_id: 'p',
      ai_result: { decision: { kind: 'retake', message: 'Plaque illisible, rapprochez-vous' } },
      ai_kept_at: '2026-11-08T08:01:00Z',
      deleted_at: null,
    },
  ],
});

const rows = [
  jobsite('a', [slot('1', 'compliant'), orange]),
  jobsite('b', [slot('2', 'compliant'), slot('w', 'waived', { waiver_reason: 'inaccessible' })], {
    lat: null,
    lng: null,
  }),
  jobsite('c', [slot('3', 'compliant'), slot('4', 'manually_validated')], {
    status: 'planned',
    planned_start: '2026-11-12',
  }),
  jobsite('d', [slot('5', 'missing'), slot('6', 'compliant')], {
    status: 'completed_by_installer',
  }),
];

describe('tableau de bord', () => {
  it('vue d’un chantier : état, score, poseurs, chantier du jour', () => {
    expect(jobsiteView(rows[0]!, '2026-11-09')).toMatchObject({
      label: 'Chantier a',
      client: 'M. Martin',
      installers: ['Jean'],
      state: 'at_risk',
      score: { ok: 1, total: 2, percent: 50 },
      today: true,
    });
    expect(jobsiteView(rows[2]!, '2026-11-09')).toMatchObject({ state: 'complete', today: false });
    expect(latestPhoto(orange)?.id).toBe('new');
  });

  it('4 tuiles', () => {
    const batches = [
      {
        id: 'l1',
        operation_code: 'BAR-TH-171',
        inspections: [
          { result: 'unsatisfactory' as const },
          ...Array(9).fill({ result: 'satisfactory' as const }),
        ],
      },
      { id: 'l2', operation_code: 'BAR-EN-101', inspections: [] },
    ];
    expect(tiles(rows, batches, 0.12, '2026-11-09')).toEqual({
      inProgress: 3,
      atRisk: 2,
      orange: 1,
      batchesNear: 1,
    });
  });

  it('« À traiter » : photo orange (avec message de l’IA), chantier incomplet, dispense, notes', () => {
    const items = todoItems(rows, [
      {
        id: 'n1',
        jobsite_id: 'a',
        kind: 'material',
        summary: 'coudes',
        quantity: 2,
        unit: null,
        created_at: '2026-11-09T09:00:00Z',
      },
      {
        id: 'n2',
        jobsite_id: 'zz',
        kind: 'problem',
        summary: 'Raccord manquant',
        quantity: null,
        unit: null,
        created_at: '2026-11-09T09:00:00Z',
      },
    ]);
    expect(items.map((i) => [i.kind, i.id])).toEqual([
      ['orange_photo', 'o'],
      ['finished_incomplete', 'd'],
      ['waiver', 'w'],
      ['problem', 'n2'],
      ['material', 'n1'],
    ]);
    expect(items[0]).toMatchObject({
      detail: 'Plaque illisible, rapprochez-vous',
      keptByInstaller: true,
      jobsiteLabel: 'Chantier a',
    });
    expect(items[1]).toMatchObject({ title: '1 preuve(s) manquante(s)' });
    expect(items.find((i) => i.id === 'n1')?.title).toBe('2 coudes');
  });

  it('liste filtrée depuis une tuile', () => {
    const views = rows.map((r) => jobsiteView(r, '2026-11-09'));
    expect(filterJobsites(views, rows, 'a-risque').map((v) => v.id)).toEqual(['a', 'b']);
    expect(filterJobsites(views, rows, 'photos-orange').map((v) => v.id)).toEqual(['a']);
    expect(filterJobsites(views, rows, 'en-cours').map((v) => v.id)).toEqual(['a', 'b', 'c']);
    expect(filterJobsites(views, rows, null)).toHaveLength(4);
  });
});
