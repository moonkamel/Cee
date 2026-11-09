import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import {
  buildComposePrompt,
  candidateRefs,
  COMPOSE_SYSTEM_PROMPT,
  type CandidatePhoto,
  createClaudeMarketingAi,
  createFakeMarketingAi,
  MARKETING_MODEL,
  resolvePair,
} from './marketing';

const image = { base64: 'AAAA', mediaType: 'image/jpeg' as const };
// Chantier d'exemple (docs/chantier-exemple.md) : façade avant, PAC posée après.
const photos: CandidatePhoto[] = [
  { id: 'facade', phase: 'avant', label: 'Façade du logement', image },
  { id: 'chaudiere', phase: 'avant', label: 'Ancienne chaudière', image },
  { id: 'pac', phase: 'apres', label: 'Unité extérieure posée', image },
];
const ctx = { works: ['Pompe à chaleur air/eau'], city: 'Rezé', company: 'Proofeo' };
const usage = { input_tokens: 500, output_tokens: 80 };

const client = (impl: (p: Record<string, unknown>) => unknown) =>
  ({
    messages: { parse: async (p: Record<string, unknown>) => impl(p) },
  }) as unknown as Anthropic;

describe('paire avant/après', () => {
  it('références A pour l’avant, B pour l’après', () => {
    expect([...candidateRefs(photos)].map(([r, p]) => [r, p.id])).toEqual([
      ['A1', 'facade'],
      ['A2', 'chaudiere'],
      ['B1', 'pac'],
    ]);
  });

  it('refuse une paire inversée ou inconnue', () => {
    expect(resolvePair(photos, ' a2', 'b1')).toEqual({ beforeId: 'chaudiere', afterId: 'pac' });
    expect(resolvePair(photos, 'B1', 'A1')).toBeNull();
    expect(resolvePair(photos, 'A9', 'B1')).toBeNull();
  });

  it('Claude choisit sur les vignettes, avec le modèle photo', async () => {
    let sent: Record<string, unknown> = {};
    const ai = createClaudeMarketingAi({
      client: client((p) => {
        sent = p;
        return {
          stop_reason: 'end_turn',
          parsed_output: { before: 'A1', after: 'B1', reason: 'même cadrage' },
          model: MARKETING_MODEL,
          usage,
        };
      }),
    });
    expect(await ai.choosePair(photos)).toEqual({
      ok: true,
      beforeId: 'facade',
      afterId: 'pac',
      reason: 'même cadrage',
      model: 'claude-haiku-5-5',
      inputTokens: 500,
      outputTokens: 80,
    });
    const content = (sent.messages as { content: { type: string }[] }[])[0]!.content;
    expect(content.map((c) => c.type)).toEqual(['text', 'image', 'text', 'image', 'text', 'image']);
  });

  it('réponse refusée, illisible ou paire invalide', async () => {
    const run = (out: unknown) =>
      createClaudeMarketingAi({ client: client(() => out) }).choosePair(photos);
    expect(await run({ stop_reason: 'refusal' })).toMatchObject({ kind: 'refused' });
    expect(await run({ stop_reason: 'max_tokens', parsed_output: null })).toMatchObject({
      kind: 'invalid',
    });
    expect(
      await run({
        stop_reason: 'end_turn',
        parsed_output: { before: 'B1', after: 'A1', reason: '' },
      }),
    ).toMatchObject({ kind: 'invalid' });
  });
});

describe('zones et légendes', () => {
  it('ne transmet que l’entreprise, la ville et les travaux', () => {
    expect(buildComposePrompt(ctx)).toBe(
      'Entreprise : Proofeo\nVille : Rezé\nTravaux : Pompe à chaleur air/eau',
    );
    expect(buildComposePrompt({ works: [], city: null, company: 'X' })).toContain(
      'Ville : non précisée\nTravaux : rénovation énergétique',
    );
    expect(COMPOSE_SYSTEM_PROMPT).toContain('Jamais d’adresse');
  });

  it('Claude reçoit les deux photos puis le contexte', async () => {
    let sent: Record<string, unknown> = {};
    const draft = {
      before_regions: [{ kind: 'street_number', x: 0.1, y: 0.1, w: 0.05, h: 0.05 }],
      after_regions: [],
      captions: { sobre: 'a', chaleureux: 'b', technique: 'c' },
    };
    const ai = createClaudeMarketingAi({
      client: client((p) => {
        sent = p;
        return { stop_reason: 'end_turn', parsed_output: draft, model: MARKETING_MODEL, usage };
      }),
    });
    expect(await ai.compose(image, image, ctx)).toMatchObject({ ok: true, draft });
    const content = (sent.messages as { content: { type: string }[] }[])[0]!.content;
    expect(content.map((c) => c.type)).toEqual(['image', 'image', 'text']);
  });

  it('erreurs : surcharge à réessayer, clé refusée, refus, réponse vide', async () => {
    const run = (impl: () => unknown) =>
      createClaudeMarketingAi({ client: client(impl) }).compose(image, image, ctx);
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
    ).toMatchObject({ kind: 'retry' });
    const denied = new Anthropic.AuthenticationError(401, undefined, 'non', new Headers());
    expect(
      await run(() => {
        throw denied;
      }),
    ).toMatchObject({ kind: 'retry', message: 'clé API refusée' });
    const bad = new Anthropic.BadRequestError(400, undefined, 'trop grande', new Headers());
    expect(
      await run(() => {
        throw bad;
      }),
    ).toMatchObject({ kind: 'invalid' });
    expect(
      await run(() => {
        throw new Error('boum');
      }),
    ).toMatchObject({ kind: 'invalid', message: 'Error: boum' });
    expect(await run(() => ({ stop_reason: 'refusal' }))).toMatchObject({ kind: 'refused' });
    expect(await run(() => ({ stop_reason: 'end_turn', parsed_output: null }))).toMatchObject({
      kind: 'invalid',
    });
  });
});

describe('fournisseur factice', () => {
  it('première photo avant, dernière après, légendes avec la ville', async () => {
    const ai = createFakeMarketingAi();
    expect(await ai.choosePair(photos)).toMatchObject({ beforeId: 'facade', afterId: 'pac' });
    expect(await ai.choosePair(photos.slice(0, 2))).toMatchObject({ ok: false });
    const out = await ai.compose(image, image, ctx);
    expect(out.ok && out.draft.captions.sobre).toBe(
      'Chantier terminé à Rezé : Pompe à chaleur air/eau.',
    );
    const bare = await ai.compose(image, image, { works: [], city: null, company: 'X' });
    expect(bare.ok && bare.draft.captions.chaleureux).toBe(
      'Encore un beau chantier ! rénovation énergétique.',
    );
  });
});
