// Contenu d'un rapport (colonne reports.content), sans dépendance au fournisseur d'IA :
// lu par le web et la logique de mise en page. Recopié pour les Edge Functions (deno-copy.ts).
import { z } from 'zod';

/** Rapports rédigés par l'IA (la préparation de contrôle arrive avec les lots, S15). */
export const REPORT_KINDS = ['daily', 'completion', 'dispute'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_SECTIONS = ['summary', 'works', 'reserves', 'attention'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

/** Phrase enregistrée : ses justifications pointent vers de vraies photos et notes. */
export const reportSentenceSchema = z.object({
  text: z.string().min(1),
  photo_ids: z.array(z.string()),
  note_ids: z.array(z.string()),
});
export type ReportSentence = z.infer<typeof reportSentenceSchema>;

/** Contenu d'une version de rapport (colonne reports.content). */
export const reportContentSchema = z.object({
  kind: z.enum(REPORT_KINDS),
  period: z.string().nullable(),
  /** Photos couvertes par le rapport (sélection du dossier de litige, photos du jour…). */
  photo_ids: z.array(z.string()),
  note_ids: z.array(z.string()),
  sections: z.object({
    summary: z.array(reportSentenceSchema),
    works: z.array(reportSentenceSchema),
    reserves: z.array(reportSentenceSchema),
    attention: z.array(reportSentenceSchema),
  }),
  /** Modèle d'IA de la première version ; « bureau » après une modification à la main. */
  written_by: z.string(),
  /** Phrases de l'IA écartées faute de justification valable. */
  dropped: z.number().int().min(0),
});
export type ReportContent = z.infer<typeof reportContentSchema>;
