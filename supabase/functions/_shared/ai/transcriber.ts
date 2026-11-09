// Généré depuis packages/shared/src/ai/transcriber.ts : ne pas modifier à la main.
// Transcription d'une note vocale (section 9) : interface remplaçable, comme pour les photos.
// Claude ne transcrit pas l'audio : un service dédié s'en charge (Mistral Voxtral, voir mistral.ts).

export type AudioFile = { bytes: Uint8Array<ArrayBuffer>; mediaType: string; fileName: string };

export type TranscribeResult =
  | { ok: true; text: string; model: string }
  /** `retry` : passager (réseau, surcharge, clé à corriger). `invalid` : audio inexploitable. */
  | { ok: false; kind: 'retry' | 'invalid'; message: string };

export interface Transcriber {
  transcribe(
    audio: AudioFile,
    options: { language: string; vocabulary: string[] },
  ): Promise<TranscribeResult>;
}

/** Vocabulaire du métier, pour guider la transcription et le nettoyage (section 9). */
export const TRADE_VOCABULARY = [
  'PAC',
  'pompe à chaleur',
  'R32',
  'R290',
  'calorifuge',
  'pare-vapeur',
  'ballon tampon',
  'unité extérieure',
  'unité intérieure',
  'groupe hydraulique',
  'vase d’expansion',
  'disconnecteur',
  'plancher chauffant',
  'combles perdus',
  'laine soufflée',
  'pige',
  'trappe',
  'VMC',
  'CEE',
  'RGE',
] as const;
