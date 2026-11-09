import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import {
  buildReportPrompt,
  createClaudeReportWriter,
  createFakeReportWriter,
  emptyContent,
  finalizeDraft,
  noteSource,
  photoSource,
  REPORT_MODEL,
  REPORT_SYSTEM_PROMPT,
  reportContentSchema,
  type ReportSource,
  sourceRefs,
} from './report';

// Chantier d'exemple (docs/chantier-exemple.md) : une journée de pose de la PAC.
const source: ReportSource = {
  kind: 'daily',
  period: '2026-11-09',
  operations: ['BAR-TH-171 Pompe à chaleur air/eau', 'BAR-EN-101 Isolation des combles perdus'],
  photos: [
    {
      id: 'photo-plaque',
      takenAt: '2026-11-09T15:10:00Z',
      phase: 'apres',
      slotLabel: 'Plaque de l’unité extérieure',
      caption: null,
      aiStatus: 'ok',
      extracted: { brand: 'Atlantic', model: 'Alféa Excellia', serial_number: null },
      aiReasons: [],
      outsideGeofence: false,
    },
    {
      id: 'photo-facade',
      takenAt: '2026-11-09T08:05:00Z',
      phase: 'avant',
      slotLabel: 'Façade du logement, numéro visible',
      caption: 'Façade côté rue',
      aiStatus: 'retake',
      extracted: null,
      aiReasons: ['numéro peu lisible'],
      outsideGeofence: true,
    },
  ],
  notes: [{ id: 'note-1', recordedAt: '2026-11-09T11:00:00Z', text: 'Il manque un raccord.' }],
};

describe('lignes de la base → faits remis à l’IA', () => {
  it('photo analysée : décision, remarques des contrôles échoués, plaque', () => {
    expect(
      photoSource({
        id: 'p',
        device_taken_at: '2026-11-09T10:00:00Z',
        caption: null,
        outside_geofence: null,
        ai_status: 'done',
        ai_result: {
          verdict: {
            checks: [
              { pass: true, reason: 'nette' },
              { pass: false, reason: 'plaque floue' },
            ],
            extracted: { brand: 'Atlantic' },
          },
          decision: { kind: 'retake' },
        },
        proof_slots: { instruction: 'Plaque', phase: 'apres' },
      }),
    ).toEqual({
      id: 'p',
      takenAt: '2026-11-09T10:00:00Z',
      phase: 'apres',
      slotLabel: 'Plaque',
      caption: null,
      aiStatus: 'retake',
      extracted: { brand: 'Atlantic' },
      aiReasons: ['plaque floue'],
      outsideGeofence: false,
    });
  });

  it('photo libre pas encore analysée', () => {
    const p = photoSource({
      id: 'p',
      device_taken_at: 't',
      caption: 'x',
      outside_geofence: true,
      ai_status: 'pending',
      ai_result: null,
    });
    expect(p).toMatchObject({ slotLabel: null, phase: null, aiStatus: 'pending', aiReasons: [] });
    expect(p.outsideGeofence).toBe(true);
  });

  it('note : texte nettoyé, sinon brut, sinon ignorée', () => {
    const n = { id: 'n', created_at: 't', transcript: ' brut ', transcript_clean: null };
    expect(noteSource(n)).toEqual({ id: 'n', recordedAt: 't', text: 'brut' });
    expect(noteSource({ ...n, transcript_clean: 'Propre.' })?.text).toBe('Propre.');
    expect(noteSource({ ...n, transcript: null })).toBeNull();
  });
});

describe('références courtes', () => {
  it('numérote les photos puis les notes dans l’ordre chronologique', () => {
    expect([...sourceRefs(source)]).toEqual([
      ['P1', { kind: 'photo', id: 'photo-facade' }],
      ['P2', { kind: 'photo', id: 'photo-plaque' }],
      ['N1', { kind: 'note', id: 'note-1' }],
    ]);
  });
});

describe('texte remis à l’IA', () => {
  it('contient les faits du chantier, sans identifiant technique', () => {
    const prompt = buildReportPrompt(source);
    expect(prompt).toContain('Compte rendu de la journée');
    expect(prompt).toContain('Journée : 2026-11-09');
    expect(prompt).toContain('P1 — 2026-11-09T08:05:00Z ; phase avant');
    expect(prompt).toContain('remarque « numéro peu lisible »');
    expect(prompt).toContain('prise hors du chantier');
    expect(prompt).toContain('brand : Atlantic');
    expect(prompt).not.toContain('serial_number');
    expect(prompt).toContain('N1 — 2026-11-09T11:00:00Z — « Il manque un raccord. »');
    expect(prompt).not.toContain('photo-plaque');
  });

  it('photo libre et opérations absentes', () => {
    const prompt = buildReportPrompt({
      ...source,
      kind: 'dispute',
      period: null,
      operations: [],
      photos: [{ ...source.photos[0]!, phase: null, slotLabel: null, aiStatus: null }],
      notes: [],
    });
    expect(prompt).toContain('Dossier de litige');
    expect(prompt).toContain('photo libre');
    expect(prompt).toContain('Opérations : non précisées');
    expect(prompt).not.toContain('Journée');
  });

  it('les consignes interdisent d’inventer et de juger la conformité', () => {
    expect(REPORT_SYSTEM_PROMPT).toContain('N’invente rien');
    expect(REPORT_SYSTEM_PROMPT).toContain('jamais la conformité');
  });
});

describe('contrôle de la réponse de l’IA', () => {
  it('traduit les références et écarte les phrases sans justification valable', () => {
    const content = finalizeDraft(
      {
        summary: [{ text: ' PAC posée. ', refs: ['p2', 'N1', 'P2'] }],
        works: [
          { text: 'Chaudière déposée.', refs: ['P9'] },
          { text: 'Sans source.', refs: [] },
        ],
        reserves: [{ text: '   ', refs: ['P1'] }],
        attention: [{ text: 'Façade à reprendre.', refs: ['P1'] }],
      },
      source,
      REPORT_MODEL,
    );
    expect(content.sections.summary).toEqual([
      { text: 'PAC posée.', photo_ids: ['photo-plaque'], note_ids: ['note-1'] },
    ]);
    expect(content.sections.works).toEqual([]);
    expect(content.sections.reserves).toEqual([]);
    expect(content.sections.attention[0]!.photo_ids).toEqual(['photo-facade']);
    expect(content.dropped).toBe(3);
    expect(content.photo_ids).toEqual(['photo-plaque', 'photo-facade']);
    expect(content.note_ids).toEqual(['note-1']);
    expect(reportContentSchema.safeParse(content).success).toBe(true);
  });

  it('sans donnée, le rapport est vide et n’a rien coûté', () => {
    const content = emptyContent({ ...source, photos: [], notes: [] });
    expect(content.written_by).toBe('aucun');
    expect(Object.values(content.sections).flat()).toEqual([]);
  });

  it('le schéma refuse une phrase vide', () => {
    const bad = { ...emptyContent(source), sections: { ...emptyContent(source).sections } };
    bad.sections.summary = [{ text: '', photo_ids: [], note_ids: [] }];
    expect(reportContentSchema.safeParse(bad).success).toBe(false);
  });
});

describe('rédacteur Claude', () => {
  const client = (impl: (p: Record<string, unknown>) => unknown) =>
    ({
      messages: { parse: async (p: Record<string, unknown>) => impl(p) },
    }) as unknown as Anthropic;
  const draft = {
    summary: [{ text: 'PAC posée.', refs: ['P2'] }],
    works: [],
    reserves: [],
    attention: [],
  };

  it('envoie les données au modèle des rapports et renvoie le brouillon validé', async () => {
    let sent: Record<string, unknown> = {};
    const writer = createClaudeReportWriter({
      client: client((p) => {
        sent = p;
        return {
          stop_reason: 'end_turn',
          parsed_output: draft,
          model: REPORT_MODEL,
          usage: { input_tokens: 900, output_tokens: 200 },
        };
      }),
    });
    expect(await writer.write(source)).toEqual({
      ok: true,
      draft,
      model: REPORT_MODEL,
      inputTokens: 900,
      outputTokens: 200,
    });
    expect(sent.model).toBe('claude-sonnet-5-5');
    expect(sent.system).toBe(REPORT_SYSTEM_PROMPT);
    expect(sent.messages).toEqual([{ role: 'user', content: buildReportPrompt(source) }]);
  });

  it('refus, réponse illisible et pannes', async () => {
    const run = (impl: () => unknown) =>
      createClaudeReportWriter({ client: client(impl) }).write(source);
    expect(await run(() => ({ stop_reason: 'refusal', parsed_output: null }))).toMatchObject({
      ok: false,
      kind: 'refused',
    });
    expect(await run(() => ({ stop_reason: 'max_tokens', parsed_output: null }))).toMatchObject({
      ok: false,
      kind: 'invalid',
    });
    const overloaded = new Anthropic.InternalServerError(
      529,
      undefined,
      'surchargé',
      new Headers(),
    );
    expect(
      await run(() => {
        throw overloaded;
      }),
    ).toMatchObject({ ok: false, kind: 'retry' });
    expect(
      await run(() => {
        throw new Error('boum');
      }),
    ).toMatchObject({ ok: false, kind: 'invalid', message: 'Error: boum' });
  });
});

describe('rédacteur factice (CI)', () => {
  it('chaque phrase est justifiée et survit au contrôle', async () => {
    const result = await createFakeReportWriter().write(source);
    if (!result.ok) throw new Error('le rédacteur factice ne doit pas échouer');
    const content = finalizeDraft(result.draft, source, result.model);
    expect(content.dropped).toBe(0);
    expect(content.sections.works).toHaveLength(2);
    expect(content.sections.attention.map((s) => s.text)).toEqual([
      'Photo à vérifier par le bureau.',
      'Il manque un raccord.',
    ]);
  });

  it('rien à résumer : pas de résumé', async () => {
    const result = await createFakeReportWriter().write({ ...source, photos: [], notes: [] });
    expect(result).toMatchObject({ ok: true, draft: { summary: [] } });
  });
});
