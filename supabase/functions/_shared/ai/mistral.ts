// Généré depuis packages/shared/src/ai/mistral.ts : ne pas modifier à la main.
// Transcription par Mistral Voxtral (API européenne : données traitées dans l'UE, RGPD).
import type { Transcriber, TranscribeResult } from './transcriber.ts';

export const TRANSCRIBE_MODEL = 'voxtral-mini-latest';
export const MISTRAL_EU_URL = 'https://api.eu.mistral.ai';

export function createMistralTranscriber({
  apiKey,
  model = TRANSCRIBE_MODEL,
  baseUrl = MISTRAL_EU_URL,
  fetchImpl = fetch,
}: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Transcriber {
  return {
    async transcribe(audio, { language, vocabulary }): Promise<TranscribeResult> {
      const form = new FormData();
      form.append('model', model);
      form.append('language', language);
      for (const word of vocabulary) form.append('context_bias', word);
      form.append('file', new Blob([audio.bytes], { type: audio.mediaType }), audio.fileName);
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/v1/audio/transcriptions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
          body: form,
        });
      } catch (error) {
        return { ok: false, kind: 'retry', message: `réseau : ${String(error)}` };
      }
      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 200);
        // 401/403 : clé absente ou refusée, rien ne se perd ; 429 et 5xx : passager.
        const retry =
          response.status === 401 ||
          response.status === 403 ||
          response.status === 429 ||
          response.status >= 500;
        return {
          ok: false,
          kind: retry ? 'retry' : 'invalid',
          message: `Mistral ${response.status} : ${detail}`,
        };
      }
      const body = (await response.json().catch(() => null)) as {
        text?: unknown;
        model?: unknown;
      } | null;
      if (!body || typeof body.text !== 'string') {
        return { ok: false, kind: 'invalid', message: 'réponse sans texte' };
      }
      return {
        ok: true,
        text: body.text.trim(),
        model: typeof body.model === 'string' ? body.model : model,
      };
    },
  };
}
