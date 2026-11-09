import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { createClaudeAnalyzer, PHOTO_MODEL } from './claude';
import { evaluate, type EvalCase } from './evaluate';
import { createFakeAnalyzer, failVerdict, okVerdict } from './fake';
import { buildUserPrompt, describeCheck } from './prompt';
import { aiVerdictSchema, decideVerdict, shortMessage, type AiVerdict } from './verdict';

const CHECKS = ['plate_readable', 'sharp'];

describe('décision affichée', () => {
  it('vert seulement si tout passe avec assurance', () => {
    expect(decideVerdict(okVerdict(CHECKS))).toEqual({ kind: 'compliant' });
    const unsure: AiVerdict = {
      ...okVerdict(CHECKS),
      checks: CHECKS.map((id) => ({ id, pass: true, confidence: 0.4, reason: '?' })),
    };
    expect(decideVerdict(unsure)).toMatchObject({ kind: 'review' });
  });

  it('orange avec le message de l’IA quand un défaut est sûr', () => {
    const v = failVerdict(CHECKS, 'plate_readable', 'Plaque illisible, rapprochez-vous');
    expect(decideVerdict(v)).toEqual({
      kind: 'retake',
      message: 'Plaque illisible, rapprochez-vous',
    });
  });

  it('un défaut incertain part au bureau sans déranger le poseur', () => {
    const v = failVerdict(CHECKS, 'plate_readable', 'Plaque peut-être illisible');
    v.checks[0]!.confidence = 0.3;
    expect(decideVerdict(v)).toMatchObject({ kind: 'review' });
    expect(decideVerdict({ ...okVerdict([]), checks: [] })).toMatchObject({ kind: 'review' });
    // Incohérence (status ok mais contrôle raté) : le bureau tranche.
    expect(decideVerdict({ ...failVerdict(CHECKS, 'sharp', 'Floue'), status: 'ok' })).toMatchObject(
      { kind: 'review' },
    );
  });

  it('message de 8 mots au plus, sinon un message sûr', () => {
    expect(shortMessage({ ...okVerdict(CHECKS), user_message: '  Photo   floue, reprenez ' })).toBe(
      'Photo floue, reprenez',
    );
    expect(
      shortMessage({
        ...okVerdict(CHECKS),
        user_message: 'un deux trois quatre cinq six sept huit neuf',
      }),
    ).toBe('Photo à reprendre');
    expect(shortMessage({ ...okVerdict(CHECKS), user_message: '' })).toBe('Photo à reprendre');
  });
});

describe('consigne envoyée à l’IA', () => {
  it('décrit chaque contrôle et les données à lire', () => {
    const text = buildUserPrompt({
      instruction: "Plaque de l'unité extérieure",
      hint: 'Rapprochez-vous',
      checks: ['plate_readable', 'subject:heat_pump_outdoor', 'inconnu_x'],
      extract: ['brand', 'serial_number'],
    });
    expect(text).toContain("Preuve attendue : Plaque de l'unité extérieure (Rapprochez-vous).");
    expect(text).toContain('plate_readable : la plaque');
    expect(text).toContain('l’unité extérieure d’une pompe à chaleur');
    expect(text).toContain('Données à lire : brand, serial_number.');
    expect(describeCheck('subject:radiateur_fonte')).toBe('on voit bien radiateur fonte');
    expect(describeCheck('inconnu_x')).toBe('inconnu x');
  });
});

describe('analyseur Claude', () => {
  const image = { base64: 'AAAA', mediaType: 'image/jpeg' as const };
  const task = { instruction: 'Plaque', checks: CHECKS, extract: [] };
  const fakeClient = (impl: (params: Record<string, unknown>) => unknown) =>
    ({
      messages: { parse: async (p: Record<string, unknown>) => impl(p) },
    }) as unknown as Anthropic;

  it('envoie l’image et la consigne au modèle rapide, renvoie le verdict validé', async () => {
    let sent: Record<string, unknown> = {};
    const verdict = okVerdict(CHECKS);
    const analyzer = createClaudeAnalyzer({
      client: fakeClient((p) => {
        sent = p;
        return {
          stop_reason: 'end_turn',
          parsed_output: verdict,
          model: PHOTO_MODEL,
          usage: { input_tokens: 1200, output_tokens: 90 },
        };
      }),
    });
    const result = await analyzer.analyze(image, task);
    expect(result).toEqual({
      ok: true,
      verdict,
      model: PHOTO_MODEL,
      inputTokens: 1200,
      outputTokens: 90,
    });
    expect(sent.model).toBe('claude-haiku-5-5');
    const content = (sent.messages as { content: { type: string }[] }[])[0]!.content;
    expect(content.map((c) => c.type)).toEqual(['image', 'text']);
  });

  it('refus et réponse illisible : au bureau ; surcharge et réseau : nouvel essai', async () => {
    const refused = createClaudeAnalyzer({
      client: fakeClient(() => ({ stop_reason: 'refusal', parsed_output: null })),
    });
    expect(await refused.analyze(image, task)).toMatchObject({ ok: false, kind: 'refused' });

    const garbled = createClaudeAnalyzer({
      client: fakeClient(() => ({ stop_reason: 'max_tokens', parsed_output: null })),
    });
    expect(await garbled.analyze(image, task)).toMatchObject({ ok: false, kind: 'invalid' });

    const down = createClaudeAnalyzer({
      client: fakeClient(() => {
        throw new Anthropic.APIConnectionError({ message: 'réseau' });
      }),
    });
    expect(await down.analyze(image, task)).toMatchObject({ ok: false, kind: 'retry' });

    const broken = createClaudeAnalyzer({
      client: fakeClient(() => {
        throw new Error('bug');
      }),
    });
    expect(await broken.analyze(image, task)).toMatchObject({ ok: false, kind: 'invalid' });
  });

  it('le schéma refuse une réponse incomplète', () => {
    expect(aiVerdictSchema.safeParse({ status: 'ok', checks: [] }).success).toBe(false);
    expect(aiVerdictSchema.safeParse(okVerdict(CHECKS)).success).toBe(true);
  });
});

describe('jeu d’évaluation', () => {
  const plate = { instruction: "Plaque de l'unité extérieure", checks: CHECKS, extract: [] };
  const unit = { instruction: 'Unité extérieure posée', checks: ['sharp'], extract: [] };
  const cases: EvalCase[] = [
    { file: 'a.jpg', template: 'PAC_AIR_EAU', task: plate, expected: { ok: true } },
    {
      file: 'b.jpg',
      template: 'PAC_AIR_EAU',
      task: plate,
      expected: { ok: false, failing: 'plate_readable' },
    },
    {
      file: 'c.jpg',
      template: 'PAC_AIR_EAU',
      task: unit,
      expected: { ok: false, failing: 'sharp' },
    },
    { file: 'd.jpg', template: 'COMBLES_PERDUS', task: unit, expected: { ok: true } },
  ];

  it('compte fausses alertes et oublis, par contrôle et par modèle', async () => {
    // L'analyseur signale toutes les plaques et laisse passer toutes les unités.
    const analyzer = createFakeAnalyzer([
      {
        match: /Plaque/,
        result: (checks) => ({
          ok: true,
          verdict: failVerdict(checks, 'plate_readable', 'Plaque illisible, rapprochez-vous'),
          model: 'fake',
          inputTokens: 0,
          outputTokens: 0,
        }),
      },
    ]);
    const report = await evaluate(cases, analyzer, async () => ({
      base64: '',
      mediaType: 'image/jpeg',
    }));
    expect(report.outcomes.map((o) => [o.file, o.falseAlert, o.miss])).toEqual([
      ['a.jpg', true, false],
      ['b.jpg', false, false],
      ['c.jpg', false, true],
      ['d.jpg', false, false],
    ]);
    expect(report.total).toMatchObject({
      cases: 4,
      falseAlerts: 1,
      misses: 1,
      falseAlertRate: 0.5,
      missRate: 0.5,
    });
    expect(report.byCheck.plate_readable).toMatchObject({ falseAlerts: 1, misses: 0 });
    expect(report.byCheck.sharp).toMatchObject({ misses: 1 });
    expect(report.byTemplate.COMBLES_PERDUS).toMatchObject({ cases: 1, falseAlerts: 0 });
  });

  it('une erreur d’analyse compte comme « au bureau », pas comme une réussite', async () => {
    const analyzer = createFakeAnalyzer([
      { match: /./, result: () => ({ ok: false, kind: 'retry', message: 'réseau' }) },
    ]);
    const report = await evaluate(cases.slice(1, 2), analyzer, async () => ({
      base64: '',
      mediaType: 'image/jpeg',
    }));
    expect(report.total).toMatchObject({ misses: 0, reviews: 1 });
  });
});

describe('manifest du jeu d’évaluation', () => {
  const entry = {
    file: 'p.jpg',
    template: 'PAC_AIR_EAU',
    instruction: 'Plaque',
    checks: ['plate_readable'],
    expected: 'plate_readable',
  };

  it('lit les attendus « ok » ou le contrôle en défaut', async () => {
    const { parseManifest, formatReport, summarize } = await import('./evaluate');
    const cases = parseManifest([entry, { ...entry, file: 'q.jpg', expected: 'ok' }]);
    expect(cases.map((c) => c.expected)).toEqual([
      { ok: false, failing: 'plate_readable' },
      { ok: true },
    ]);
    expect(formatReport(summarize([], []))).toContain('Photos : 0');
  });

  it('refuse une entrée incomplète ou un contrôle non demandé', async () => {
    const { parseManifest } = await import('./evaluate');
    expect(() => parseManifest([{ ...entry, file: '' }])).toThrow(/entrée 1/);
    expect(() => parseManifest([{ ...entry, expected: 'sharp' }])).toThrow(/sharp/);
  });
});
