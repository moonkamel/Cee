import { describe, expect, it } from 'vitest';
import {
  buildOperation,
  checklistSummary,
  effectiveAnswers,
  isShown,
  itemOf,
  pickTemplate,
  planSlots,
  reconcileSlots,
  unansweredQuestions,
  type ExistingSlot,
  type SummarySlot,
} from './engine';
import { parseTemplate, TemplateError } from './schema';

const PAC = {
  code: 'PAC_TEST',
  version: '1.0.0',
  trade: 'chauffage',
  cee_operation: 'BAR-TH-171',
  title: 'PAC air/eau',
  questions: [
    { key: 'old_boiler_removed', label: 'Ancienne chaudière déposée ?', type: 'yes_no' },
    {
      key: 'indoor_units',
      label: 'Unités intérieures',
      type: 'number',
      min: 1,
      max: 4,
      default: 1,
    },
  ],
  items: [
    { key: 'facade', phase: 'avant', label: 'Façade du logement' },
    {
      key: 'old_boiler',
      phase: 'avant',
      label: 'Ancienne chaudière avant dépose',
      show_if: { old_boiler_removed: true },
    },
    { key: 'indoor_unit', phase: 'apres', label: 'Unité intérieure posée', repeat: 'indoor_units' },
    {
      key: 'big_install',
      phase: 'apres',
      label: 'Collecteur commun',
      show_if: { indoor_units: { gte: 3 } },
    },
    { key: 'sheet', phase: 'apres', label: 'Fiche de mise en service', required: false },
  ],
};
const template = parseTemplate(PAC);

describe('schéma des modèles', () => {
  it('applique les valeurs par défaut (obligatoire, 1 photo, brouillon)', () => {
    expect(template.items[0]).toMatchObject({ required: true, min_photos: 1, ai_checks: [] });
    expect(template.review).toEqual({ status: 'draft' });
  });

  it.each([
    ['question inconnue', { items: [{ ...PAC.items[1], show_if: { nope: true } }] }],
    [
      'condition de mauvais type',
      { items: [{ ...PAC.items[1], show_if: { indoor_units: true } }] },
    ],
    ['repeat sur un oui/non', { items: [{ ...PAC.items[2], repeat: 'old_boiler_removed' }] }],
    ['élément en double', { items: [PAC.items[0], PAC.items[0]] }],
    ['question en double', { questions: [PAC.questions[0], PAC.questions[0]] }],
    [
      'consigne trop longue',
      { items: [{ ...PAC.items[0], label: 'un deux trois quatre cinq six sept huit neuf' }] },
    ],
    ['version invalide', { version: '1.0' }],
    ['aucun élément', { items: [] }],
    ['défaut hors bornes', { questions: [{ ...PAC.questions[1], default: 9 }] }],
  ])('refuse : %s', (_, patch) => {
    expect(() => parseTemplate({ ...PAC, ...patch })).toThrow(TemplateError);
  });
});

describe('réponses et conditions', () => {
  it('complète les nombres par défaut, laisse les oui/non sans réponse', () => {
    expect(effectiveAnswers(template, {})).toEqual({ indoor_units: 1 });
    expect(effectiveAnswers(template, { indoor_units: 9 })).toEqual({ indoor_units: 4 });
    expect(unansweredQuestions(template, {}).map((q) => q.key)).toEqual(['old_boiler_removed']);
    expect(unansweredQuestions(template, { old_boiler_removed: false })).toEqual([]);
  });

  it('sans réponse, une preuve conditionnelle reste affichée', () => {
    expect(isShown({ old_boiler_removed: true }, {})).toBe(true);
    expect(isShown({ old_boiler_removed: true }, { old_boiler_removed: false })).toBe(false);
    expect(isShown({ indoor_units: { gte: 3 } }, { indoor_units: 2 })).toBe(false);
    expect(isShown({ indoor_units: { lte: 3 } }, { indoor_units: 4 })).toBe(false);
    expect(isShown({ indoor_units: 2 }, { indoor_units: 2 })).toBe(true);
    expect(isShown({ indoor_units: { gte: 1 } }, { indoor_units: true })).toBe(false);
  });
});

describe('preuves attendues', () => {
  it('une preuve par unité intérieure, numérotée quand il y en a plusieurs', () => {
    const one = planSlots(template, { indoor_units: 1 }).filter((s) =>
      s.itemKey.startsWith('indoor'),
    );
    expect(one.map((s) => [s.itemKey, s.instruction])).toEqual([
      ['indoor_unit#1', 'Unité intérieure posée'],
    ]);
    const three = planSlots(template, { indoor_units: 3 }).filter((s) =>
      s.itemKey.startsWith('indoor'),
    );
    expect(three.map((s) => s.instruction)).toEqual([
      'Unité intérieure posée (1)',
      'Unité intérieure posée (2)',
      'Unité intérieure posée (3)',
    ]);
    expect(itemOf(template, 'indoor_unit#2')?.key).toBe('indoor_unit');
    expect(itemOf(template, 'indoor_unit#2~reprise-1')?.key).toBe('indoor_unit');
    expect(itemOf(template, 'inconnu')).toBeNull();
  });

  it('« non » à la dépose masque la photo de l’ancienne chaudière', () => {
    const plan = planSlots(template, { old_boiler_removed: false });
    expect(plan.find((s) => s.itemKey === 'old_boiler')?.applicable).toBe(false);
    expect(plan.find((s) => s.itemKey === 'facade')?.applicable).toBe(true);
  });
});

describe('suivre les réponses sans rien supprimer', () => {
  const existing = (answers = {}): ExistingSlot[] =>
    planSlots(template, answers)
      .filter((p) => p.applicable)
      .map((p) => ({
        id: `s-${p.itemKey}`,
        item_key: p.itemKey,
        instruction: p.instruction,
        position: p.position,
        applicable: true,
      }));

  it('ajoute les unités en plus, renumérote, puis masque celles en trop', () => {
    const start = existing({ indoor_units: 1 });
    const up = reconcileSlots(start, planSlots(template, { indoor_units: 3 }));
    expect(up.insert.map((p) => p.itemKey)).toEqual([
      'indoor_unit#2',
      'indoor_unit#3',
      'big_install',
    ]);
    expect(up.update).toEqual([
      { id: 's-indoor_unit#1', changes: { instruction: 'Unité intérieure posée (1)' } },
    ]);

    const three = existing({ indoor_units: 3 });
    const down = reconcileSlots(three, planSlots(template, { indoor_units: 1 }));
    expect(down.insert).toEqual([]);
    expect(down.update).toEqual(
      expect.arrayContaining([
        { id: 's-indoor_unit#2', changes: { applicable: false } },
        { id: 's-indoor_unit#3', changes: { applicable: false } },
        { id: 's-big_install', changes: { applicable: false } },
        { id: 's-indoor_unit#1', changes: { instruction: 'Unité intérieure posée' } },
      ]),
    );
  });

  it('les preuves de reprise après contrôle restent affichées, quelles que soient les réponses', () => {
    const start = [
      ...existing({}),
      {
        id: 'r1',
        item_key: 'old_boiler~reprise-1',
        instruction: 'x',
        position: 0,
        applicable: true,
      },
    ];
    const r = reconcileSlots(start, planSlots(template, { old_boiler_removed: false }));
    expect(r.update).toEqual([{ id: 's-old_boiler', changes: { applicable: false } }]);
  });

  it('masque puis réaffiche une preuve selon la réponse', () => {
    const start = existing({});
    const hidden = reconcileSlots(start, planSlots(template, { old_boiler_removed: false }));
    expect(hidden.update).toEqual([{ id: 's-old_boiler', changes: { applicable: false } }]);
    const back = reconcileSlots(
      start.map((s) => (s.item_key === 'old_boiler' ? { ...s, applicable: false } : s)),
      planSlots(template, { old_boiler_removed: true }),
    );
    expect(back.update).toEqual([{ id: 's-old_boiler', changes: { applicable: true } }]);
  });

  it('ne crée pas une preuve masquée', () => {
    expect(
      reconcileSlots([], planSlots(template, { old_boiler_removed: false })).insert.map(
        (p) => p.itemKey,
      ),
    ).not.toContain('old_boiler');
  });
});

describe('écran de fin de chantier', () => {
  const slot = (over: Partial<SummarySlot> & { id: string }): SummarySlot => ({
    phase: 'apres',
    position: 0,
    required: true,
    applicable: true,
    status: 'missing',
    waiverValidated: false,
    ...over,
  });

  it('« 3 preuves sur 3 » quand tout est pris ou dispensé', () => {
    const s = checklistSummary([
      slot({ id: 'a', status: 'captured' }),
      slot({ id: 'b', status: 'compliant' }),
      slot({ id: 'c', status: 'waived' }),
      slot({ id: 'd', applicable: false }), // masquée par une réponse
      slot({ id: 'e', required: false }),
    ]);
    expect(s).toMatchObject({ total: 3, done: 3, complete: true });
    expect(s.optionalMissing.map((x) => x.id)).toEqual(['e']);
    expect(s.waiversPending.map((x) => x.id)).toEqual(['c']);
  });

  it('liste les manques dans l’ordre conseillé, reprises comprises', () => {
    const s = checklistSummary([
      slot({ id: 'apres', phase: 'apres', position: 1 }),
      slot({ id: 'avant', phase: 'avant', position: 5 }),
      slot({ id: 'reprise', phase: 'pendant', status: 'to_retake' }),
      slot({ id: 'ok', status: 'captured' }),
      slot({ id: 'dispense', status: 'waived', waiverValidated: true }),
    ]);
    expect(s.missing.map((x) => x.id)).toEqual(['avant', 'reprise', 'apres']);
    expect(s).toMatchObject({ total: 5, done: 2, complete: false, waiversPending: [] });
  });
});

describe('alerte IA gardée par le poseur', () => {
  it('ne compte plus comme manque, part au bureau', () => {
    const base = {
      phase: 'apres' as const,
      position: 0,
      required: true,
      applicable: true,
      waiverValidated: false,
    };
    const s = checklistSummary([
      { ...base, id: 'kept', status: 'to_retake', aiKept: true },
      { ...base, id: 'retake', status: 'to_retake' },
    ]);
    expect(s.missing.map((x) => x.id)).toEqual(['retake']);
    expect(s.keptPending.map((x) => x.id)).toEqual(['kept']);
    expect(s).toMatchObject({ total: 2, done: 1, complete: false });
  });
});

describe('choix du modèle et génération', () => {
  const row = (over: Record<string, unknown>) => ({
    id: 'g1',
    code: 'PAC_TEST',
    version: '1.0.0',
    company_id: null,
    published: true,
    valid_from: null,
    valid_to: null,
    content: PAC,
    ...over,
  });

  it('préfère la copie de l’entreprise, puis la dernière version publiée en vigueur', () => {
    const rows = [
      row({ id: 'g1' }),
      row({ id: 'g2', version: '1.10.0' }),
      row({ id: 'g3', version: '2.0.0', published: false }),
      row({ id: 'g4', version: '3.0.0', valid_to: '2026-01-01' }),
      row({ id: 'g5', version: '4.0.0', valid_from: '2027-01-01' }),
      row({ id: 'autre', code: 'AUTRE' }),
    ];
    expect(pickTemplate(rows, 'PAC_TEST', '2026-11-09')?.id).toBe('g2');
    expect(
      pickTemplate([...rows, row({ id: 'maison', company_id: 'c1' })], 'PAC_TEST', '2026-11-09')
        ?.id,
    ).toBe('maison');
    expect(pickTemplate(rows, 'INCONNU', '2026-11-09')).toBeNull();
  });

  it('crée l’opération (modèle figé) et ses preuves visibles', () => {
    let n = 0;
    const { operation, slots } = buildOperation({
      jobsiteId: 'j1',
      templateRow: row({}),
      answers: { old_boiler_removed: false },
      newId: () => `id${++n}`,
    });
    expect(operation).toMatchObject({
      id: 'id1',
      jobsite_id: 'j1',
      code: 'BAR-TH-171',
      template_id: 'g1',
      template_version: '1.0.0',
      template_snapshot: PAC,
      label: 'PAC air/eau',
      answers: { old_boiler_removed: false },
    });
    expect(slots.map((s) => s.item_key)).toEqual(['facade', 'indoor_unit#1', 'sheet']);
    expect(slots[0]).toMatchObject({
      operation_id: 'id1',
      jobsite_id: 'j1',
      status: 'missing',
      applicable: true,
      required: true,
      min_photos: 1,
      phase: 'avant',
    });
  });

  it('refuse un modèle invalide plutôt que de générer une checklist fausse', () => {
    expect(() =>
      buildOperation({
        jobsiteId: 'j1',
        templateRow: row({ content: { demo: true } }),
        newId: () => 'x',
      }),
    ).toThrow(TemplateError);
  });
});
