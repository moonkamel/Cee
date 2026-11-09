import { describe, expect, it } from 'vitest';
import { canDecide, decisionWrites, permissions, retakeMessage } from './decision';
import { jobsiteScore, jobsiteState } from './score';
import { isOverdue, sortTodo, type TodoItem } from './todo';

const s = (status: string, more: object = {}) => ({
  status: status as never,
  required: true,
  ...more,
});

describe('score et état d’un chantier', () => {
  it('compte les obligatoires conformes, validées ou dispensées validées', () => {
    expect(
      jobsiteScore([
        s('compliant'),
        s('manually_validated'),
        s('waived', { waiverValidated: true }),
        s('captured'),
        s('missing', { required: false }),
        s('missing', { applicable: false }),
      ]),
    ).toEqual({ ok: 3, total: 4, percent: 75 });
    expect(jobsiteScore([])).toEqual({ ok: 0, total: 0, percent: 0 });
  });

  it('à risque, complet ou à compléter', () => {
    expect(jobsiteState([s('compliant'), s('to_retake')])).toBe('at_risk');
    expect(jobsiteState([s('compliant'), s('waived')])).toBe('at_risk');
    expect(jobsiteState([s('compliant'), s('waived', { waiverValidated: true })])).toBe('complete');
    expect(jobsiteState([s('compliant'), s('captured')])).toBe('to_complete');
    expect(jobsiteState([s('to_retake', { applicable: false }), s('compliant')])).toBe('complete');
    expect(jobsiteState([])).toBe('to_complete');
  });
});

describe('liste « À traiter »', () => {
  const item = (kind: TodoItem['kind'], since: string, id: string = kind): TodoItem => ({
    kind,
    id,
    jobsiteId: 'j',
    jobsiteLabel: 'Bron',
    title: kind,
    detail: null,
    since,
  });

  it('gravité d’abord, puis le plus ancien', () => {
    const sorted = sortTodo([
      item('material', '2026-11-01'),
      item('orange_photo', '2026-11-09', 'récente'),
      item('waiver', '2026-11-02'),
      item('orange_photo', '2026-11-08', 'ancienne'),
      item('finished_incomplete', '2026-11-09'),
      item('problem', '2026-11-03'),
    ]);
    expect(sorted.map((i) => i.id)).toEqual([
      'ancienne',
      'récente',
      'finished_incomplete',
      'waiver',
      'problem',
      'material',
    ]);
  });

  it('photo orange non tranchée depuis plus de 48 h', () => {
    expect(isOverdue(item('orange_photo', '2026-11-06T08:00:00Z'), '2026-11-09T08:00:00Z')).toBe(
      true,
    );
    expect(isOverdue(item('orange_photo', '2026-11-08T08:00:00Z'), '2026-11-09T08:00:00Z')).toBe(
      false,
    );
    expect(isOverdue(item('waiver', '2026-11-01T08:00:00Z'), '2026-11-09T08:00:00Z')).toBe(false);
  });
});

describe('décision sur une photo orange', () => {
  it('réservée au chef, au bureau, à l’admin et au dirigeant', () => {
    expect(
      ['installer', 'lead', 'office', 'admin', 'owner'].map((r) => canDecide(r as never)),
    ).toEqual([false, true, true, true, true]);
    expect(canDecide(null)).toBe(false);
    expect(permissions('office')).toMatchObject({ decide: true, export: true, manageTeam: false });
    expect(permissions('lead')).toMatchObject({
      decide: true,
      export: false,
      seeAllJobsites: false,
    });
    expect(permissions('owner')).toMatchObject({ manageTeam: true, editTemplates: true });
  });

  it('message de reprise : saisi, sinon celui de l’IA, 8 mots au plus', () => {
    expect(retakeMessage('', 'Plaque illisible, rapprochez-vous')).toBe(
      'Plaque illisible, rapprochez-vous',
    );
    expect(retakeMessage('  Refaire de face  ', 'x')).toBe('Refaire de face');
    expect(retakeMessage(null, null)).toBe('Photo à reprendre');
    expect(retakeMessage('un deux trois quatre cinq six sept huit neuf dix', null)).toBe(
      'un deux trois quatre cinq six sept huit',
    );
  });

  it('écritures : validation, ou reprise avec demande au poseur', () => {
    expect(decisionWrites({ kind: 'validate', slotId: 's' }, 'u')).toEqual({
      slot: { id: 's', status: 'manually_validated' },
      request: null,
    });
    expect(
      decisionWrites(
        { kind: 'retake', slotId: 's', jobsiteId: 'j', recipientId: 'p', message: 'Refaire' },
        'u',
      ),
    ).toEqual({
      slot: { id: 's', status: 'to_retake' },
      request: {
        jobsite_id: 'j',
        proof_slot_id: 's',
        requested_by: 'u',
        recipient_id: 'p',
        message: 'Refaire',
      },
    });
  });
});
