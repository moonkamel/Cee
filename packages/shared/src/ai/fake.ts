// Analyseur factice : tests, CI et démonstration sans clé. Le verdict dépend de la consigne.
import type { AnalyzeResult, PhotoAnalyzer } from './analyzer';
import type { AiVerdict } from './verdict';

const EMPTY = {
  brand: null,
  model: null,
  serial_number: null,
  product: null,
  thermal_resistance: null,
};

export function okVerdict(checks: string[]): AiVerdict {
  return {
    status: 'ok',
    checks: checks.map((id) => ({ id, pass: true, confidence: 0.95, reason: 'visible' })),
    extracted: EMPTY,
    user_message: '',
    privacy_regions: [],
  };
}

/** Un contrôle raté avec assurance : orange, message au poseur. */
export function failVerdict(checks: string[], failing: string, message: string): AiVerdict {
  return {
    status: 'warn',
    checks: checks.map((id) => ({
      id,
      pass: id !== failing,
      confidence: 0.9,
      reason: id === failing ? 'défaut visible' : 'visible',
    })),
    extracted: EMPTY,
    user_message: message,
    privacy_regions: [],
  };
}

/**
 * Par défaut tout est conforme ; `rules` permet d'imposer un résultat selon la consigne
 * (ex. « Plaque » → plaque illisible), pour tester l'orange de bout en bout.
 */
export function createFakeAnalyzer(
  rules: { match: RegExp; result: (checks: string[]) => AnalyzeResult }[] = [],
): PhotoAnalyzer & { calls: number } {
  const analyzer = {
    calls: 0,
    async analyze(_image: unknown, task: { instruction: string; checks: string[] }) {
      analyzer.calls += 1;
      const rule = rules.find((r) => r.match.test(task.instruction));
      if (rule) return rule.result(task.checks);
      return {
        ok: true as const,
        verdict: okVerdict(task.checks),
        model: 'fake',
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
  return analyzer;
}
