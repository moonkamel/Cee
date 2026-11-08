// Format des modèles de checklists (section 7), validé avant toute publication.
// Un modèle traduit une fiche CEE en une suite de photos simples à prendre.
import { z } from 'zod';
import { PROOF_PHASES } from '../statuses';

/** Consignes de 8 mots maximum (CLAUDE.md, principe 3 de la section 1). */
export const MAX_INSTRUCTION_WORDS = 8;

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const key = z.string().regex(/^[a-z][a-z0-9_]*$/, 'clé en minuscules, chiffres et _');
const shortText = z
  .string()
  .min(1)
  .refine((s) => wordCount(s) <= MAX_INSTRUCTION_WORDS, {
    message: `${MAX_INSTRUCTION_WORDS} mots maximum`,
  });

const yesNoQuestion = z.object({
  key,
  label: z.string().min(1),
  type: z.literal('yes_no'),
  default: z.boolean().optional(),
});

const numberQuestion = z
  .object({
    key,
    label: z.string().min(1),
    type: z.literal('number'),
    min: z.int().min(0).default(0),
    max: z.int().min(1).max(20),
    default: z.int().min(0),
  })
  .refine((q) => q.min <= q.default && q.default <= q.max, {
    message: 'default doit être entre min et max',
  });

export const questionSchema = z.discriminatedUnion('type', [yesNoQuestion, numberQuestion]);

/** Condition d'affichage : oui/non attendu, nombre exact, ou plage { gte, lte }. */
const conditionValue = z.union([
  z.boolean(),
  z.int(),
  z
    .object({ gte: z.int().optional(), lte: z.int().optional() })
    .refine((r) => r.gte !== undefined || r.lte !== undefined, { message: 'gte ou lte requis' }),
]);

export const itemSchema = z.object({
  key,
  phase: z.enum(PROOF_PHASES),
  label: shortText,
  hint: shortText.optional(),
  required: z.boolean().default(true),
  min_photos: z.int().min(1).max(10).default(1),
  /** Toutes les conditions doivent être vraies (ET). */
  show_if: z.record(key, conditionValue).optional(),
  /** Une preuve par unité, selon une question numérique (« Unité intérieure 2 »). */
  repeat: key.optional(),
  example_image: z.string().optional(),
  ai_checks: z.array(z.string()).default([]),
  extract: z.array(z.string()).default([]),
});

export const templateSchema = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version x.y.z'),
    trade: z.string().min(1),
    cee_operation: z.string().optional(),
    title: z.string().min(1),
    /** Relecture par un professionnel du métier, obligatoire avant usage réel (section 7). */
    review: z
      .object({
        status: z.enum(['draft', 'reviewed']),
        reviewer: z.string().optional(),
        date: z.string().optional(),
      })
      .default({ status: 'draft' }),
    questions: z.array(questionSchema).default([]),
    items: z.array(itemSchema).min(1),
  })
  .superRefine((t, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path });
    const questions = new Map(t.questions.map((q) => [q.key, q]));
    if (questions.size !== t.questions.length) issue('clé de question en double', ['questions']);
    const itemKeys = new Set<string>();
    t.items.forEach((item, i) => {
      if (itemKeys.has(item.key)) issue(`élément en double : ${item.key}`, ['items', i, 'key']);
      itemKeys.add(item.key);
      for (const [qKey, value] of Object.entries(item.show_if ?? {})) {
        const q = questions.get(qKey);
        if (!q) issue(`question inconnue : ${qKey}`, ['items', i, 'show_if', qKey]);
        else if ((q.type === 'yes_no') !== (typeof value === 'boolean'))
          issue(`condition incompatible avec ${qKey}`, ['items', i, 'show_if', qKey]);
      }
      if (item.repeat) {
        const q = questions.get(item.repeat);
        if (q?.type !== 'number')
          issue(`repeat doit viser une question numérique`, ['items', i, 'repeat']);
      }
    });
  });

export type ChecklistTemplate = z.infer<typeof templateSchema>;
export type ChecklistQuestion = z.infer<typeof questionSchema>;
export type ChecklistItem = z.infer<typeof itemSchema>;
/** Réponses aux questions rapides (jobsite_operations.answers). */
export type ChecklistAnswers = Record<string, boolean | number>;

export class TemplateError extends Error {}

/** Valide un modèle ; l'erreur liste les problèmes en clair. */
export function parseTemplate(content: unknown): ChecklistTemplate {
  const result = templateSchema.safeParse(content);
  if (!result.success) {
    throw new TemplateError(
      result.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; '),
    );
  }
  return result.data;
}
