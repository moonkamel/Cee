// Rapports (section 9, S13) : logique de relecture et de mise en page, sans IA.
// Le gabarit PDF du web ne fait qu'afficher ce que ces fonctions préparent.
import {
  REPORT_SECTIONS,
  reportContentSchema,
  type ReportContent,
  type ReportKind,
  type ReportSection,
} from '../ai/report-content';

export {
  REPORT_KINDS,
  REPORT_SECTIONS,
  reportContentSchema,
  type ReportContent,
  type ReportKind,
  type ReportSection,
  type ReportSentence,
} from '../ai/report-content';

export const REPORT_TITLES: Record<ReportKind, string> = {
  daily: 'Compte rendu du jour',
  completion: 'Rapport de fin de chantier',
  dispute: 'Dossier de litige',
};

export const SECTION_TITLES: Record<ReportSection, string> = {
  summary: 'Résumé',
  works: 'Travaux réalisés',
  reserves: 'Réserves',
  attention: 'Points d’attention',
};

/** Photos par page du PDF : grille de 2 × 3 (section 9). */
export const PHOTOS_PER_PAGE = 6;

export function chunk<T>(items: readonly T[], size = PHOTOS_PER_PAGE): T[][] {
  if (size < 1) throw new Error('Taille de page invalide');
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

const PARIS = 'Europe/Paris';

/** « 09/11/2026 16:10 », à l'heure de Paris, quel que soit le fuseau du serveur. */
export function formatParis(iso: string, withTime = true): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
    .format(date)
    .replace(',', '');
}

/** Lit le contenu d'une version ; une ligne abîmée donne un rapport vide plutôt qu'une erreur. */
export function parseContent(raw: unknown, kind: ReportKind): ReportContent {
  const parsed = reportContentSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return {
    kind,
    period: null,
    photo_ids: [],
    note_ids: [],
    sections: { summary: [], works: [], reserves: [], attention: [] },
    written_by: 'illisible',
    dropped: 0,
  };
}

/** Modification du bureau : nouveau texte par phrase, et phrases ajoutées par section. */
export type ReportEdits = {
  texts: Partial<Record<ReportSection, string[]>>;
  added?: Partial<Record<ReportSection, string>>;
};

/**
 * Contenu de la version suivante. Une phrase vidée est retirée ; une phrase modifiée garde ses
 * justifications ; une phrase ajoutée par le bureau n'en a pas (elle est signée « bureau »).
 */
export function applyEdits(content: ReportContent, edits: ReportEdits): ReportContent {
  const sections = { ...content.sections };
  for (const key of REPORT_SECTIONS) {
    const texts = edits.texts[key];
    const kept = content.sections[key].flatMap((sentence, i) => {
      const text = (texts?.[i] ?? sentence.text).trim();
      return text ? [{ ...sentence, text }] : [];
    });
    const added = (edits.added?.[key] ?? '')
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ text, photo_ids: [], note_ids: [] }));
    sections[key] = [...kept, ...added];
  }
  return reportContentSchema.parse({ ...content, sections, written_by: 'bureau' });
}

/** Vrai si la modification change quelque chose (sinon, pas de nouvelle version). */
export function contentChanged(a: ReportContent, b: ReportContent): boolean {
  return JSON.stringify(a.sections) !== JSON.stringify(b.sections);
}

export type ReportVersionRow = {
  id: string;
  series_id: string;
  version: number;
  kind: ReportKind;
  created_at: string;
};

/** Dernière version de chaque série, la plus récente en tête. */
export function latestVersions<T extends ReportVersionRow>(rows: readonly T[]): T[] {
  const bySeries = new Map<string, T>();
  for (const r of rows) {
    const current = bySeries.get(r.series_id);
    if (!current || r.version > current.version) bySeries.set(r.series_id, r);
  }
  return [...bySeries.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Numéros des photos citées par une phrase, dans l'ordre de la grille du PDF. */
export function photoNumbers(photoIds: readonly string[], order: readonly string[]): number[] {
  return photoIds
    .map((id) => order.indexOf(id) + 1)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
}

/** Nom du fichier : référence, type, version (sans caractère gênant). */
export function reportFileName(reference: string | null, kind: ReportKind, version: number) {
  const ref = (reference ?? 'chantier').replace(/[^A-Za-z0-9-]+/g, '_');
  return `${ref}_${kind}_v${version}.pdf`;
}

/** Empreinte SHA-256 en hexadécimal (Web Crypto : navigateur, Node, Deno). */
export async function sha256Hex(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type Equipment = {
  label: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
};

/** Équipements posés, lus par l'IA sur les plaques (une ligne par plaque lisible). */
export function equipmentFrom(
  photos: readonly { label: string; ai_result: unknown; phase?: string | null }[],
): Equipment[] {
  const seen = new Set<string>();
  return photos.flatMap((p) => {
    // Plaque prise « avant » : l'ancien équipement déposé, pas un équipement posé.
    if (p.phase === 'avant') return [];
    const ex = (p.ai_result as { verdict?: { extracted?: Record<string, string | null> } } | null)
      ?.verdict?.extracted;
    const item = {
      label: p.label,
      brand: ex?.brand ?? null,
      model: ex?.model ?? null,
      serialNumber: ex?.serial_number ?? null,
    };
    if (!item.brand && !item.model && !item.serialNumber) return [];
    const key = [item.brand, item.model, item.serialNumber].join('|');
    if (seen.has(key)) return [];
    seen.add(key);
    return [item];
  });
}

/** Preuves obligatoires encore à photographier (compte rendu du jour, fin de chantier). */
export function missingProofs(
  slots: readonly {
    instruction: string;
    required: boolean;
    applicable: boolean;
    status: string;
    phase: string;
    position: number;
  }[],
): string[] {
  const order = ['avant', 'pendant', 'apres'];
  return slots
    .filter(
      (s) => s.applicable && s.required && (s.status === 'missing' || s.status === 'to_retake'),
    )
    .sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase) || a.position - b.position)
    .map((s) => s.instruction);
}
