// Interface remplaçable d'analyse d'une photo (CLAUDE.md : appels IA via packages/shared/ai).
import type { PhotoTask } from './prompt';
import type { AiVerdict } from './verdict';

export type PhotoImage = { base64: string; mediaType: 'image/jpeg' | 'image/png' };

export type AnalyzeResult =
  | { ok: true; verdict: AiVerdict; model: string; inputTokens: number; outputTokens: number }
  /**
   * `retry` : passager (réseau, surcharge, quota du fournisseur) — on réessaiera.
   * `refused` : le modèle a décliné. `invalid` : réponse inexploitable. Ces deux cas vont au bureau.
   */
  | { ok: false; kind: 'retry' | 'refused' | 'invalid'; message: string };

export interface PhotoAnalyzer {
  analyze(image: PhotoImage, task: PhotoTask): Promise<AnalyzeResult>;
}
