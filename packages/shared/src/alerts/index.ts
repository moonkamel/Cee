// Lots CEE et alertes (section 10, S15) : niveau d'alerte d'un lot, liste « À corriger en
// priorité », reprise après un contrôle, préférences d'alertes, import d'un lot.
import { batchStatus } from '../office/batch';
import type { InspectionResult, Role } from '../statuses';

// --- Alertes ------------------------------------------------------------------------------------

export type AlertChannel = 'push' | 'email' | 'push_email';

/** Tableau des alertes de la section 10 (et notifications déjà existantes). */
export const ALERTS = {
  jobsite_incomplete: {
    label: 'Chantier terminé avec des preuves manquantes',
    critical: false,
    channel: 'push',
  },
  orange_overdue: {
    label: 'Photos orange non tranchées depuis 48 h',
    critical: false,
    channel: 'email',
  },
  batch_threshold: {
    label: 'Lot proche du seuil ou au-dessus',
    critical: true,
    channel: 'push_email',
  },
  inspection_failed: { label: 'Contrôle non satisfaisant', critical: true, channel: 'push' },
  rge_expiring: { label: 'Qualification RGE bientôt expirée', critical: false, channel: 'email' },
  correction_planned: {
    label: 'Reprise planifiée après contrôle',
    critical: false,
    channel: 'push',
  },
  report_ready: { label: 'Rapport prêt à relire', critical: false, channel: 'push' },
  photo_request: { label: 'Photo à reprendre', critical: false, channel: 'push' },
} as const satisfies Record<string, { label: string; critical: boolean; channel: AlertChannel }>;
export type AlertKind = keyof typeof ALERTS;
export const ALERT_KINDS = Object.keys(ALERTS) as AlertKind[];

/**
 * Une alerte peut être coupée sauf si elle est critique pour le dirigeant : les alertes de seuil
 * et de contrôle restent actives pour lui (section 10).
 */
export function canMute(kind: AlertKind, role: Role): boolean {
  return !(ALERTS[kind].critical && role === 'owner');
}

/** Préférences enregistrées → alertes réellement coupées pour ce rôle. */
export function effectiveMuted(requested: readonly string[], role: Role): AlertKind[] {
  return ALERT_KINDS.filter((k) => requested.includes(k) && canMute(k, role));
}

/** Une adresse e-mail facultative ; vide : les alertes arrivent en notification seulement. */
export function normalizeEmail(input: string): string | null | 'invalid' {
  const v = input.trim().toLowerCase();
  if (!v) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : 'invalid';
}

// --- Lots ---------------------------------------------------------------------------------------

export type BatchLevel = 'normal' | 'near' | 'over';
const LEVEL_RANK: Record<BatchLevel, number> = { normal: 0, near: 1, over: 2 };

/** Niveau d'alerte d'un lot : au-dessus du seuil, à moins de 2 points, ou normal. */
export function batchLevel(results: readonly InspectionResult[], threshold: number): BatchLevel {
  const s = batchStatus(results, threshold);
  return s.over ? 'over' : s.near ? 'near' : 'normal';
}

/** L'alerte du dirigeant ne repart que si la situation s'aggrave. */
export function levelWorsened(before: BatchLevel, after: BatchLevel): boolean {
  return LEVEL_RANK[after] > LEVEL_RANK[before];
}

/** Un chantier entre dans un lot s'il porte la fiche du lot et que ses travaux tombent dans la période. */
export function fitsBatch(
  jobsite: { operationCodes: readonly string[]; date: string | null },
  batch: { operationCode: string; start: string | null; end: string | null },
): { ok: boolean; reason?: string } {
  if (!jobsite.operationCodes.includes(batch.operationCode)) {
    return { ok: false, reason: `pas d’opération ${batch.operationCode}` };
  }
  if (jobsite.date && batch.start && jobsite.date < batch.start)
    return { ok: false, reason: 'avant la période' };
  if (jobsite.date && batch.end && jobsite.date > batch.end)
    return { ok: false, reason: 'après la période' };
  return { ok: true };
}

/** Références du fichier du délégataire (chantier ou devis) → chantiers trouvés et non trouvés. */
export function matchReferences<
  T extends { id: string; reference: string | null; quote_reference: string | null },
>(references: readonly string[], jobsites: readonly T[]): { found: T[]; missing: string[] } {
  const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');
  const byRef = new Map<string, T>();
  for (const j of jobsites) {
    if (j.reference) byRef.set(norm(j.reference), j);
    if (j.quote_reference) byRef.set(norm(j.quote_reference), j);
  }
  const found = new Map<string, T>();
  const missing: string[] = [];
  for (const raw of references) {
    if (!raw.trim()) continue;
    const j = byRef.get(norm(raw));
    if (j) found.set(j.id, j);
    else missing.push(raw.trim());
  }
  return { found: [...found.values()], missing: [...new Set(missing)] };
}

/** Colonne des références dans le fichier : celle où le plus de valeurs correspondent. */
export function referenceColumn(
  rows: readonly string[][],
  known: readonly { reference: string | null; quote_reference: string | null }[],
): number {
  const set = new Set(
    known
      .flatMap((j) => [j.reference, j.quote_reference])
      .filter(Boolean)
      .map((r) => r!.trim().toUpperCase()),
  );
  const width = Math.max(0, ...rows.map((r) => r.length));
  let best = 0;
  let bestHits = -1;
  for (let c = 0; c < width; c += 1) {
    const hits = rows.filter((r) => set.has((r[c] ?? '').trim().toUpperCase())).length;
    if (hits > bestHits) [best, bestHits] = [c, hits];
  }
  return best;
}

// --- Contrôles et reprises ------------------------------------------------------------------------

export type InspectionRow = {
  id: string;
  jobsite_id: string;
  result: InspectionResult;
  inspected_on: string;
  corrected_on: string | null;
  correction_planned_at: string | null;
};

/** « À corriger en priorité » : non satisfaisants pas encore repris, les plus anciens d'abord. */
export function priorityCorrections<T extends InspectionRow>(rows: readonly T[]): T[] {
  return rows
    .filter((r) => r.result === 'unsatisfactory' && !r.corrected_on)
    .sort(
      (a, b) =>
        Number(Boolean(a.correction_planned_at)) - Number(Boolean(b.correction_planned_at)) ||
        a.inspected_on.localeCompare(b.inspected_on),
    );
}

/** Séparateur des preuves de reprise dans item_key (« outdoor_unit~reprise-1 »). */
export const CORRECTION_SEPARATOR = '~reprise-';

export function isCorrectionKey(itemKey: string): boolean {
  return itemKey.includes(CORRECTION_SEPARATOR);
}

/** Nouvelles preuves « après correction » : jamais à la place des anciennes, toujours en plus. */
export function correctionSlots(
  chosen: readonly { item_key: string; instruction: string; operation_id: string }[],
  existingKeys: readonly string[],
): {
  item_key: string;
  instruction: string;
  operation_id: string;
  phase: 'apres';
  required: true;
}[] {
  const taken = new Set(existingKeys);
  return chosen.map((s) => {
    const base = s.item_key.split(CORRECTION_SEPARATOR)[0]!;
    let n = 1;
    while (taken.has(`${base}${CORRECTION_SEPARATOR}${n}`)) n += 1;
    const key = `${base}${CORRECTION_SEPARATOR}${n}`;
    taken.add(key);
    const label = s.instruction.replace(/ \(après correction\)$/, '');
    return {
      item_key: key,
      instruction: `${label} (après correction)`,
      operation_id: s.operation_id,
      phase: 'apres',
      required: true,
    };
  });
}

// --- Récapitulatifs quotidiens ----------------------------------------------------------------------

/** Qualifications RGE qui expirent dans les 60 jours (ou moins), à partir d'aujourd'hui. */
export function expiringQualifications(raw: unknown, today: string, days = 60) {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  const end = limit.toISOString().slice(0, 10);
  return (Array.isArray(raw) ? raw : []).filter((q) => {
    const d = (q as { date_fin?: string }).date_fin;
    return typeof d === 'string' && d >= today && d <= end;
  }) as { organisme?: string; numero?: string; date_fin: string }[];
}
