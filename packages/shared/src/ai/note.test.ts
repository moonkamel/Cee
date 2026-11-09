import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { createMistralTranscriber, MISTRAL_EU_URL, TRANSCRIBE_MODEL } from './mistral';
import {
  createClaudeNoteCleaner,
  createFakeNoteCleaner,
  createFakeTranscriber,
  NOTE_MODEL,
  noteCleanupSchema,
} from './note';
import { TRADE_VOCABULARY } from './transcriber';

const audio = { bytes: new Uint8Array([1, 2, 3]), mediaType: 'audio/mp4', fileName: 'n.m4a' };
const opts = { language: 'fr', vocabulary: ['PAC', 'R32'] };

describe('transcription Mistral Voxtral', () => {
  it('envoie l’audio, la langue et le vocabulaire à l’API européenne', async () => {
    let call: { url: string; init: RequestInit } | null = null;
    const t = createMistralTranscriber({
      apiKey: 'k',
      fetchImpl: (async (url: string, init: RequestInit) => {
        call = { url, init };
        return new Response(
          JSON.stringify({ text: ' il manque un raccord ', model: 'voxtral-mini-2602' }),
        );
      }) as typeof fetch,
    });
    expect(await t.transcribe(audio, opts)).toEqual({
      ok: true,
      text: 'il manque un raccord',
      model: 'voxtral-mini-2602',
    });
    expect(call!.url).toBe(`${MISTRAL_EU_URL}/v1/audio/transcriptions`);
    expect((call!.init.headers as Record<string, string>).Authorization).toBe('Bearer k');
    const form = call!.init.body as FormData;
    expect(form.get('model')).toBe(TRANSCRIBE_MODEL);
    expect(form.get('language')).toBe('fr');
    expect(form.getAll('context_bias')).toEqual(['PAC', 'R32']);
    expect(form.get('file')).toBeInstanceOf(Blob);
  });

  it.each([
    [429, 'retry'],
    [500, 'retry'],
    [401, 'retry'],
    [400, 'invalid'],
  ] as const)('HTTP %i → %s', async (status, kind) => {
    const t = createMistralTranscriber({
      apiKey: 'k',
      fetchImpl: (async () => new Response('erreur', { status })) as typeof fetch,
    });
    expect(await t.transcribe(audio, opts)).toMatchObject({ ok: false, kind });
  });

  it('réseau absent : nouvel essai ; réponse sans texte : inexploitable', async () => {
    const down = createMistralTranscriber({
      apiKey: 'k',
      fetchImpl: (async () => {
        throw new Error('hors ligne');
      }) as typeof fetch,
    });
    expect(await down.transcribe(audio, opts)).toMatchObject({ ok: false, kind: 'retry' });
    const empty = createMistralTranscriber({
      apiKey: 'k',
      fetchImpl: (async () => new Response('{}')) as typeof fetch,
    });
    expect(await empty.transcribe(audio, opts)).toMatchObject({ ok: false, kind: 'invalid' });
  });
});

describe('nettoyage de la note par Claude', () => {
  const client = (impl: (p: Record<string, unknown>) => unknown) =>
    ({
      messages: { parse: async (p: Record<string, unknown>) => impl(p) },
    }) as unknown as Anthropic;
  const cleanup = {
    clean_text: 'Il manque un raccord sur la PAC.',
    problems: [{ summary: 'Raccord manquant' }],
    materials: [{ item: 'raccord 3/4', quantity: 1, unit: null }],
  };

  it('envoie la transcription au modèle rapide, renvoie le résultat validé', async () => {
    let sent: Record<string, unknown> = {};
    const c = createClaudeNoteCleaner({
      client: client((p) => {
        sent = p;
        return {
          stop_reason: 'end_turn',
          parsed_output: cleanup,
          model: NOTE_MODEL,
          usage: { input_tokens: 300, output_tokens: 80 },
        };
      }),
    });
    expect(await c.clean('il manque un raccord sur la pac')).toMatchObject({ ok: true, cleanup });
    expect(sent.model).toBe('claude-haiku-5-5');
    expect(String(sent.system)).toContain('pare-vapeur');
    expect(sent.messages).toEqual([{ role: 'user', content: 'il manque un raccord sur la pac' }]);
  });

  it('refus et réponse illisible : la note reste brute, le bureau la lit', async () => {
    const refused = createClaudeNoteCleaner({
      client: client(() => ({ stop_reason: 'refusal', parsed_output: null })),
    });
    expect(await refused.clean('x')).toMatchObject({ ok: false, kind: 'refused' });
    const garbled = createClaudeNoteCleaner({
      client: client(() => ({ stop_reason: 'max_tokens', parsed_output: null })),
    });
    expect(await garbled.clean('x')).toMatchObject({ ok: false, kind: 'invalid' });
  });

  it('le schéma exige le texte, les problèmes et le matériel', () => {
    expect(noteCleanupSchema.safeParse(cleanup).success).toBe(true);
    expect(noteCleanupSchema.safeParse({ clean_text: 'x' }).success).toBe(false);
    expect(TRADE_VOCABULARY).toContain('R32');
  });
});

describe('analyseurs factices (CI)', () => {
  it('repère un manque et du matériel à commander', async () => {
    const t = await createFakeTranscriber().transcribe();
    const r = await createFakeNoteCleaner().clean(t.text);
    expect(r).toMatchObject({
      ok: true,
      cleanup: {
        clean_text: 'Il manque un raccord, commander 2 coudes.',
        problems: [{ summary: 'Il manque un raccord' }],
        materials: [{ item: 'coudes', quantity: 2 }],
      },
    });
    expect((await createFakeNoteCleaner().clean('')).ok).toBe(true);
  });
});
