// Suivi des lots CEE (section 10) : taux de non-conformité observé face au seuil de l'année.
// Indicateur interne : il ne remplace ni le contrôle officiel ni le calcul du délégataire.
import type { InspectionResult } from '../statuses';

/** Marge d'alerte : un lot à moins de 2 points du seuil est « proche du seuil ». */
export const THRESHOLD_MARGIN = 0.02;

export function batchRate(results: readonly InspectionResult[]): {
  rate: number;
  done: number;
  failed: number;
} {
  const done = results.length;
  const failed = results.filter((r) => r === 'unsatisfactory').length;
  return { rate: done ? failed / done : 0, done, failed };
}

export function batchStatus(results: readonly InspectionResult[], threshold: number) {
  const { rate, done, failed } = batchRate(results);
  // Projection : combien de chantiers non satisfaisants de plus font dépasser le seuil.
  let more = 0;
  while (done > 0 && (failed + more) / (done + more) <= threshold && more < 1000) more += 1;
  return {
    rate,
    done,
    over: done > 0 && rate > threshold,
    near: done > 0 && rate > threshold - THRESHOLD_MARGIN,
    failuresBeforeOver: done > 0 ? more : null,
  };
}
