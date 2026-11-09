// Généré depuis packages/shared/src/ai/claude.ts : ne pas modifier à la main.
// Analyseur Claude (vision) : modèle rapide et économique pour les photos (CLAUDE.md, section 8).
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AnalyzeResult, PhotoAnalyzer } from './analyzer.ts';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.ts';
import { aiVerdictSchema } from './verdict.ts';

export const PHOTO_MODEL = 'claude-haiku-5-5';

export function createClaudeAnalyzer({
  client,
  model = PHOTO_MODEL,
}: {
  client: Anthropic;
  model?: string;
}): PhotoAnalyzer {
  return {
    async analyze(image, task): Promise<AnalyzeResult> {
      try {
        const response = await client.messages.parse({
          model,
          max_tokens: 2048,
          // Tâche de classement courte : effort bas, un seul appel par photo (coûts, section 8).
          output_config: { effort: 'low', format: zodOutputFormat(aiVerdictSchema) },
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
                },
                { type: 'text', text: buildUserPrompt(task) },
              ],
            },
          ],
        });
        if (response.stop_reason === 'refusal') {
          return { ok: false, kind: 'refused', message: 'analyse déclinée par le modèle' };
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
          verdict: response.parsed_output,
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
      } catch (error) {
        if (
          error instanceof Anthropic.RateLimitError ||
          error instanceof Anthropic.InternalServerError ||
          error instanceof Anthropic.APIConnectionError
        ) {
          return { ok: false, kind: 'retry', message: error.message };
        }
        if (error instanceof Anthropic.AuthenticationError) {
          // Clé absente ou révoquée : rien ne se perd, la file attend la correction.
          return { ok: false, kind: 'retry', message: 'clé API refusée' };
        }
        if (error instanceof Anthropic.APIError) {
          return { ok: false, kind: 'invalid', message: `API ${error.status} : ${error.message}` };
        }
        return { ok: false, kind: 'invalid', message: String(error) };
      }
    },
  };
}
