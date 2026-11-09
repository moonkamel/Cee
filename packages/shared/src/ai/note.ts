// Nettoyage d'une note vocale par l'IA (section 9) : ponctuation, vocabulaire du métier,
// problèmes à signaler au bureau, matériel à commander. L'IA signale, elle n'agit pas seule.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { TRADE_VOCABULARY } from './transcriber';

export const NOTE_MODEL = 'claude-haiku-5-5';

export const noteCleanupSchema = z.object({
  /** Texte fidèle, ponctué, avec les bons termes ; rien d'ajouté. */
  clean_text: z.string(),
  problems: z.array(z.object({ summary: z.string() })),
  materials: z.array(
    z.object({ item: z.string(), quantity: z.number().nullable(), unit: z.string().nullable() }),
  ),
});
export type NoteCleanup = z.infer<typeof noteCleanupSchema>;

export type CleanResult =
  | { ok: true; cleanup: NoteCleanup; model: string; inputTokens: number; outputTokens: number }
  | { ok: false; kind: 'retry' | 'refused' | 'invalid'; message: string };

export interface NoteCleaner {
  clean(transcript: string): Promise<CleanResult>;
}

export const NOTE_SYSTEM_PROMPT = [
  'Tu reçois la transcription brute d’une note dictée par un poseur sur un chantier de rénovation énergétique.',
  'clean_text : le même contenu, en français correct et ponctué, avec les termes du métier bien écrits',
  `(${TRADE_VOCABULARY.join(', ')}). N’ajoute, ne retire et n’invente aucune information.`,
  'problems : chaque problème signalé qui demande l’attention du bureau (pièce manquante, client absent,',
  'malfaçon, accès impossible, retard). Une phrase courte chacun. Liste vide s’il n’y en a pas.',
  'materials : le matériel à commander ou à apporter mentionné, avec quantité et unité si elles sont dites',
  '(null sinon). Liste vide s’il n’y en a pas. Tu ne commandes rien : tu listes.',
].join('\n');

export function createClaudeNoteCleaner({
  client,
  model = NOTE_MODEL,
}: {
  client: Anthropic;
  model?: string;
}): NoteCleaner {
  return {
    async clean(transcript): Promise<CleanResult> {
      try {
        const response = await client.messages.parse({
          model,
          max_tokens: 4096,
          output_config: { effort: 'low', format: zodOutputFormat(noteCleanupSchema) },
          system: NOTE_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: transcript }],
        });
        if (response.stop_reason === 'refusal') {
          return { ok: false, kind: 'refused', message: 'nettoyage décliné par le modèle' };
        }
        if (!response.parsed_output) {
          return {
            ok: false,
            kind: 'invalid',
            message: `réponse illisible (${response.stop_reason})`,
          };
        }
        return {
          ok: true,
          cleanup: response.parsed_output,
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
      } catch (error) {
        if (
          error instanceof Anthropic.RateLimitError ||
          error instanceof Anthropic.InternalServerError ||
          error instanceof Anthropic.APIConnectionError ||
          error instanceof Anthropic.AuthenticationError
        ) {
          return { ok: false, kind: 'retry', message: error.message };
        }
        return { ok: false, kind: 'invalid', message: String(error) };
      }
    },
  };
}

/** Nettoyage factice (tests, CI) : repère « il manque … » et « commander … ». */
export function createFakeNoteCleaner(): NoteCleaner {
  return {
    async clean(transcript) {
      const text = transcript.trim();
      const clean = text
        ? `${text[0]!.toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? '' : '.'}`
        : '';
      const problems = [...text.matchAll(/il manque ([^,.]+)/gi)].map((m) => ({
        summary: `Il manque ${m[1]!.trim()}`,
      }));
      const materials = [...text.matchAll(/commander (\d+)?\s*([^,.]+)/gi)].map((m) => ({
        item: m[2]!.trim(),
        quantity: m[1] ? Number(m[1]) : null,
        unit: null,
      }));
      return {
        ok: true,
        cleanup: { clean_text: clean, problems, materials },
        model: 'fake',
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
}

/** Transcription factice : renvoie le texte attendu (tests, CI). */
export function createFakeTranscriber(text = 'il manque un raccord, commander 2 coudes') {
  return {
    async transcribe() {
      return { ok: true as const, text, model: 'fake' };
    },
  };
}
