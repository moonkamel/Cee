// Jeu d'évaluation du pré-contrôle IA (section 8, S10) : rejoue des photos annotées et compte
// les fausses alertes (photo bonne signalée) et les oublis (photo mauvaise laissée passer),
// au total, par contrôle et par modèle de checklist.
import type { PhotoAnalyzer, PhotoImage } from './analyzer';
import type { PhotoTask } from './prompt';
import { decideVerdict, type AiDecision } from './verdict';

export type EvalCase = {
  file: string;
  template: string;
  task: PhotoTask;
  /** Verdict humain : la photo prouve-t-elle le point demandé ? Sinon, le contrôle en défaut. */
  expected: { ok: true } | { ok: false; failing: string };
};

export type EvalOutcome = {
  file: string;
  template: string;
  decision: AiDecision | { kind: 'error'; message: string };
  /** Bonne photo signalée en orange. */
  falseAlert: boolean;
  /** Mauvaise photo passée en vert. */
  miss: boolean;
  /** Envoyée au bureau (ni vert ni orange) : ni faute, ni réussite. */
  review: boolean;
};

export type Rate = { cases: number; falseAlerts: number; misses: number; reviews: number };

export type EvalReport = {
  outcomes: EvalOutcome[];
  total: Rate & { falseAlertRate: number; missRate: number };
  byCheck: Record<string, Rate>;
  byTemplate: Record<string, Rate>;
};

const emptyRate = (): Rate => ({ cases: 0, falseAlerts: 0, misses: 0, reviews: 0 });

function add(rate: Rate, o: EvalOutcome) {
  rate.cases += 1;
  if (o.falseAlert) rate.falseAlerts += 1;
  if (o.miss) rate.misses += 1;
  if (o.review) rate.reviews += 1;
}

export function judge(c: EvalCase, decision: EvalOutcome['decision']): EvalOutcome {
  const flagged = decision.kind === 'retake';
  const passed = decision.kind === 'compliant';
  return {
    file: c.file,
    template: c.template,
    decision,
    falseAlert: c.expected.ok && flagged,
    miss: !c.expected.ok && passed,
    review: decision.kind === 'review' || decision.kind === 'error',
  };
}

export function summarize(cases: EvalCase[], outcomes: EvalOutcome[]): EvalReport {
  const total = emptyRate();
  const byCheck: Record<string, Rate> = {};
  const byTemplate: Record<string, Rate> = {};
  outcomes.forEach((o, i) => {
    const c = cases[i]!;
    add(total, o);
    add((byTemplate[c.template] ??= emptyRate()), o);
    // Une fausse alerte compte pour chaque contrôle demandé ; un oubli pour le contrôle en défaut.
    const keys = c.expected.ok ? c.task.checks : [c.expected.failing];
    for (const k of keys) add((byCheck[k] ??= emptyRate()), o);
  });
  const good = cases.filter((c) => c.expected.ok).length;
  const bad = cases.length - good;
  return {
    outcomes,
    total: {
      ...total,
      falseAlertRate: good ? total.falseAlerts / good : 0,
      missRate: bad ? total.misses / bad : 0,
    },
    byCheck,
    byTemplate,
  };
}

export async function evaluate(
  cases: EvalCase[],
  analyzer: PhotoAnalyzer,
  load: (file: string) => Promise<PhotoImage>,
): Promise<EvalReport> {
  const outcomes: EvalOutcome[] = [];
  for (const c of cases) {
    const result = await analyzer.analyze(await load(c.file), c.task);
    outcomes.push(
      judge(
        c,
        result.ok ? decideVerdict(result.verdict) : { kind: 'error', message: result.message },
      ),
    );
  }
  return summarize(cases, outcomes);
}

/**
 * Ligne du fichier manifest.json d'un dossier d'évaluation. `expected` : « ok » si la photo
 * prouve le point, sinon l'identifiant du contrôle en défaut (ex. « plate_readable »).
 */
export type ManifestEntry = {
  file: string;
  template: string;
  instruction: string;
  hint?: string;
  checks: string[];
  extract?: PhotoTask['extract'];
  expected: string;
};

export function parseManifest(entries: ManifestEntry[]): EvalCase[] {
  return entries.map((e, i) => {
    if (!e.file || !e.template || !e.instruction || !Array.isArray(e.checks) || !e.expected) {
      throw new Error(
        `manifest.json, entrée ${i + 1} : file, template, instruction, checks, expected requis`,
      );
    }
    if (e.expected !== 'ok' && !e.checks.includes(e.expected)) {
      throw new Error(
        `manifest.json, ${e.file} : « ${e.expected} » n'est pas un des contrôles demandés`,
      );
    }
    return {
      file: e.file,
      template: e.template,
      task: {
        instruction: e.instruction,
        hint: e.hint ?? null,
        checks: e.checks,
        extract: e.extract ?? [],
      },
      expected: e.expected === 'ok' ? { ok: true } : { ok: false, failing: e.expected },
    };
  });
}

/** Rapport lisible, une ligne par contrôle et par modèle. */
export function formatReport(report: EvalReport): string {
  const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : '—');
  const row = (name: string, r: Rate) =>
    `${name.padEnd(28)} ${String(r.cases).padStart(4)}  fausses alertes ${String(r.falseAlerts).padStart(3)}  oublis ${String(r.misses).padStart(3)}  au bureau ${String(r.reviews).padStart(3)}`;
  return [
    `Photos : ${report.total.cases}`,
    `Fausses alertes : ${report.total.falseAlerts} (${pct(report.total.falseAlertRate, 1)} des bonnes photos)`,
    `Oublis : ${report.total.misses} (${pct(report.total.missRate, 1)} des mauvaises photos)`,
    `Au bureau : ${report.total.reviews}`,
    '',
    'Par contrôle',
    ...Object.entries(report.byCheck).map(([k, r]) => row(k, r)),
    '',
    'Par modèle',
    ...Object.entries(report.byTemplate).map(([k, r]) => row(k, r)),
  ].join('\n');
}
