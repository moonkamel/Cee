// Contrat de sortie du pré-contrôle IA (section 8), validé par zod avant tout enregistrement.
// Fichier sans dépendance hors zod : recopié pour les Edge Functions (voir deno-copy.ts).
import { z } from 'zod';

/** Champs que l'IA peut lire sur une plaque ou une étiquette (clé `extract` des modèles). */
export const EXTRACT_FIELDS = [
  'brand',
  'model',
  'serial_number',
  'product',
  'thermal_resistance',
] as const;
export type ExtractField = (typeof EXTRACT_FIELDS)[number];

export const aiVerdictSchema = z.object({
  status: z.enum(['ok', 'warn', 'fail']),
  checks: z.array(
    z.object({
      id: z.string(),
      pass: z.boolean(),
      confidence: z.number(),
      reason: z.string(),
    }),
  ),
  extracted: z.object({
    brand: z.string().nullable(),
    model: z.string().nullable(),
    serial_number: z.string().nullable(),
    product: z.string().nullable(),
    thermal_resistance: z.string().nullable(),
  }),
  user_message: z.string(),
  /** Visages et plaques d'immatriculation à flouter sur la copie montrée au client (section 16). */
  privacy_regions: z.array(
    z.object({
      kind: z.enum(['face', 'plate']),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    }),
  ),
});
export type AiVerdict = z.infer<typeof aiVerdictSchema>;

/** Confiance sous laquelle l'IA ne dérange pas le poseur : le bureau vérifie (section 8). */
export const LOW_CONFIDENCE = 0.6;
/** Consignes et messages de 8 mots maximum (CLAUDE.md). */
export const MAX_MESSAGE_WORDS = 8;

export type AiDecision =
  /** Vert : preuve conforme. */
  | { kind: 'compliant' }
  /** Orange : message au poseur, boutons « Reprendre » et « Garder quand même ». */
  | { kind: 'retake'; message: string }
  /** Doute : la photo part au bureau « à vérifier », le poseur n'est pas dérangé. */
  | { kind: 'review'; reason: string };

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** Message court pour le poseur : celui de l'IA s'il tient en 8 mots, sinon un message sûr. */
export function shortMessage(verdict: AiVerdict, fallback = 'Photo à reprendre'): string {
  const w = words(verdict.user_message);
  return w.length > 0 && w.length <= MAX_MESSAGE_WORDS ? w.join(' ') : fallback;
}

/**
 * Verdict de l'IA → décision affichée. L'IA signale, elle ne bloque jamais, et ne valide
 * jamais un chantier : « conforme » ne vaut que pour une preuve, avec une confiance suffisante.
 */
export function decideVerdict(verdict: AiVerdict): AiDecision {
  if (verdict.checks.length === 0) return { kind: 'review', reason: 'aucun contrôle rendu' };
  const failing = verdict.checks.filter((c) => !c.pass);
  const minConfidence = Math.min(...verdict.checks.map((c) => c.confidence));

  if (verdict.status === 'ok' && failing.length === 0) {
    return minConfidence >= LOW_CONFIDENCE
      ? { kind: 'compliant' }
      : { kind: 'review', reason: 'confiance faible' };
  }
  // Un contrôle raté avec assurance : on prévient le poseur tant qu'il est sur place.
  const sure = failing.filter((c) => c.confidence >= LOW_CONFIDENCE);
  if (verdict.status !== 'ok' && sure.length > 0) {
    return { kind: 'retake', message: shortMessage(verdict) };
  }
  return { kind: 'review', reason: 'verdict incertain' };
}
