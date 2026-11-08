// Moteur de checklists (section 7) : du modèle figé et des réponses aux preuves attendues.
// Un chantier garde la version du modèle de sa création ; les réponses ne font qu'afficher
// ou masquer des preuves, jamais supprimer une photo déjà prise.
import { PROOF_PHASES, type ProofPhase, type ProofSlotStatus, type WorkType } from '../statuses';
import { slotNeedsPhoto } from '../slots';
import type { Row } from '../sync/types';
import { parseTemplate, type ChecklistAnswers, type ChecklistTemplate } from './schema';

/** Réponses complétées par les valeurs par défaut du modèle. Une question sans réponse reste absente. */
export function effectiveAnswers(
  template: ChecklistTemplate,
  answers: ChecklistAnswers,
): ChecklistAnswers {
  const out: ChecklistAnswers = {};
  for (const q of template.questions) {
    const given = answers[q.key];
    if (q.type === 'yes_no') {
      const value = typeof given === 'boolean' ? given : q.default;
      if (value !== undefined) out[q.key] = value;
    } else {
      const value = typeof given === 'number' ? given : q.default;
      out[q.key] = Math.min(q.max, Math.max(q.min, Math.round(value)));
    }
  }
  return out;
}

/** Questions encore sans réponse (oui/non sans valeur par défaut). */
export function unansweredQuestions(template: ChecklistTemplate, answers: ChecklistAnswers) {
  const effective = effectiveAnswers(template, answers);
  return template.questions.filter((q) => effective[q.key] === undefined);
}

/**
 * Une preuve s'affiche si toutes ses conditions sont vraies. Tant qu'une question n'a pas de
 * réponse, la preuve reste affichée : on ne masque jamais une preuve par défaut.
 */
export function isShown(
  showIf: ChecklistTemplate['items'][number]['show_if'],
  answers: ChecklistAnswers,
): boolean {
  for (const [qKey, expected] of Object.entries(showIf ?? {})) {
    const actual = answers[qKey];
    if (actual === undefined) continue;
    if (typeof expected === 'object') {
      if (typeof actual !== 'number') return false;
      if (expected.gte !== undefined && actual < expected.gte) return false;
      if (expected.lte !== undefined && actual > expected.lte) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

/** Preuve prévue par le modèle, avant enregistrement. */
export type PlannedSlot = {
  itemKey: string;
  instruction: string;
  phase: ProofPhase;
  position: number;
  required: boolean;
  minPhotos: number;
  applicable: boolean;
};

const REPEAT_SEPARATOR = '#';

/** Preuves attendues pour ces réponses, dans l'ordre du modèle. */
export function planSlots(template: ChecklistTemplate, answers: ChecklistAnswers): PlannedSlot[] {
  const effective = effectiveAnswers(template, answers);
  const planned: PlannedSlot[] = [];
  template.items.forEach((item, index) => {
    const shown = isShown(item.show_if, effective);
    const base = {
      phase: item.phase,
      required: item.required,
      minPhotos: item.min_photos,
      applicable: shown,
    };
    if (!item.repeat) {
      planned.push({ ...base, itemKey: item.key, instruction: item.label, position: index * 100 });
      return;
    }
    const count = Number(effective[item.repeat] ?? 0);
    for (let i = 1; i <= count; i += 1) {
      planned.push({
        ...base,
        itemKey: `${item.key}${REPEAT_SEPARATOR}${i}`,
        instruction: count > 1 ? `${item.label} (${i})` : item.label,
        position: index * 100 + i,
      });
    }
  });
  return planned;
}

/** Preuve déjà enregistrée (ligne proof_slots). */
export type ExistingSlot = {
  id: string;
  item_key: string;
  instruction: string;
  position: number;
  applicable: boolean;
};

/**
 * Ce qu'il faut écrire pour suivre les réponses : nouvelles preuves à créer, preuves à
 * masquer ou réafficher. Aucune preuve n'est supprimée (ses photos restent rattachées).
 */
export function reconcileSlots(
  existing: readonly ExistingSlot[],
  planned: readonly PlannedSlot[],
): { insert: PlannedSlot[]; update: { id: string; changes: Row }[] } {
  const byKey = new Map(existing.map((s) => [s.item_key, s]));
  const plannedKeys = new Set(planned.map((p) => p.itemKey));
  const insert: PlannedSlot[] = [];
  const update: { id: string; changes: Row }[] = [];

  for (const p of planned) {
    const current = byKey.get(p.itemKey);
    if (!current) {
      if (p.applicable) insert.push(p);
      continue;
    }
    const changes: Row = {};
    if (current.applicable !== p.applicable) changes.applicable = p.applicable;
    if (current.instruction !== p.instruction) changes.instruction = p.instruction;
    if (current.position !== p.position) changes.position = p.position;
    if (Object.keys(changes).length > 0) update.push({ id: current.id, changes });
  }
  // Unités en trop (le nombre a baissé) : masquées, pas supprimées.
  for (const s of existing) {
    if (!plannedKeys.has(s.item_key) && s.applicable) {
      update.push({ id: s.id, changes: { applicable: false } });
    }
  }
  return { insert, update };
}

/** Motifs proposés pour une preuve « Impossible » (section 7). */
export const WAIVER_REASONS = [
  'inaccessible', // équipement inaccessible
  'client_refused', // le client refuse
  'not_installed', // élément absent sur ce chantier
  'already_covered', // déjà visible sur une autre photo
  'other',
] as const;
export type WaiverReason = (typeof WAIVER_REASONS)[number];

export type SummarySlot = {
  id: string;
  phase: ProofPhase;
  position: number;
  required: boolean;
  applicable: boolean;
  status: ProofSlotStatus;
  waiverValidated: boolean;
};

export type ChecklistSummary<T extends SummarySlot> = {
  /** Preuves obligatoires applicables. */
  total: number;
  /** Obligatoires prises ou dispensées. */
  done: number;
  /** Obligatoires encore à photographier, dans l'ordre conseillé. */
  missing: T[];
  /** Facultatives pas encore prises. */
  optionalMissing: T[];
  /** Dispenses en attente de validation par le bureau. */
  waiversPending: T[];
  complete: boolean;
};

/** Écran de fin de chantier : « 9 preuves sur 9 » ou la liste des manques. */
export function checklistSummary<T extends SummarySlot>(slots: readonly T[]): ChecklistSummary<T> {
  const applicable = [...slots]
    .filter((s) => s.applicable)
    .sort(
      (a, b) =>
        PROOF_PHASES.indexOf(a.phase) - PROOF_PHASES.indexOf(b.phase) || a.position - b.position,
    );
  const required = applicable.filter((s) => s.required);
  const missing = required.filter((s) => slotNeedsPhoto(s));
  return {
    total: required.length,
    done: required.length - missing.length,
    missing,
    optionalMissing: applicable.filter((s) => !s.required && slotNeedsPhoto(s)),
    waiversPending: applicable.filter((s) => s.status === 'waived' && !s.waiverValidated),
    complete: missing.length === 0,
  };
}

/** Modèle par type de travaux de la création rapide (les autres arrivent avec la bibliothèque). */
export const WORK_TYPE_TEMPLATES: Partial<Record<WorkType, string>> = {
  pac_air_eau: 'PAC_AIR_EAU',
  combles: 'COMBLES_PERDUS',
};

const semver = (v: string) => v.split('.').map(Number);
function compareVersions(a: string, b: string): number {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i += 1) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/**
 * Modèle à utiliser pour un code : celui de l'entreprise s'il existe (copie personnalisée),
 * sinon le modèle global ; publié, en vigueur aujourd'hui, dernière version.
 */
export function pickTemplate(rows: readonly Row[], code: string, today: string): Row | null {
  const candidates = rows.filter(
    (r) =>
      r.code === code &&
      r.published === true &&
      (!r.valid_from || String(r.valid_from) <= today) &&
      (!r.valid_to || String(r.valid_to) >= today),
  );
  const own = candidates.filter((r) => r.company_id);
  const pool = own.length > 0 ? own : candidates;
  return [...pool].sort((a, b) => compareVersions(String(b.version), String(a.version)))[0] ?? null;
}

/** Opération et preuves d'un chantier, générées depuis un modèle (lignes à synchroniser). */
export function buildOperation({
  jobsiteId,
  templateRow,
  answers = {},
  newId,
}: {
  jobsiteId: string;
  templateRow: Row;
  answers?: ChecklistAnswers;
  newId: () => string;
}): { operation: Row; slots: Row[] } {
  const template = parseTemplate(templateRow.content);
  const operationId = newId();
  const operation: Row = {
    id: operationId,
    jobsite_id: jobsiteId,
    code: template.cee_operation ?? template.code,
    template_id: templateRow.id,
    template_version: template.version,
    template_snapshot: templateRow.content,
    label: template.title,
    answers,
  };
  const slots = planSlots(template, answers)
    .filter((p) => p.applicable)
    .map((p) => slotRow(p, { jobsiteId, operationId, id: newId() }));
  return { operation, slots };
}

/** Ligne proof_slots d'une preuve prévue. */
export function slotRow(
  p: PlannedSlot,
  ids: { id: string; jobsiteId: string; operationId: string },
): Row {
  return {
    id: ids.id,
    jobsite_id: ids.jobsiteId,
    operation_id: ids.operationId,
    item_key: p.itemKey,
    instruction: p.instruction,
    phase: p.phase,
    position: p.position,
    required: p.required,
    min_photos: p.minPhotos,
    applicable: true,
    status: 'missing',
  };
}

/** Élément du modèle d'une preuve (« unit#2 » → « unit »), pour l'exemple et les contrôles IA. */
export function itemOf(template: ChecklistTemplate, itemKey: string) {
  const base = itemKey.split(REPEAT_SEPARATOR)[0];
  return template.items.find((i) => i.key === base) ?? null;
}
