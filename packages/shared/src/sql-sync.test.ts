import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INSPECTION_RESULTS,
  JOBSITE_STATUSES,
  PROOF_PHASES,
  PROOF_SLOT_STATUSES,
  ROLES,
  WORK_TYPES,
} from './statuses';

// Les statuts existent en double : constantes TypeScript ici, domaines SQL dans les migrations.
// Ce test échoue dès que les deux listes divergent.
const migrationsDir = join(import.meta.dirname, '../../../supabase/migrations');
const sql = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
  .join('\n');

function domainValues(name: string): string[] {
  const match = new RegExp(
    `create domain public\\.${name} as text\\s+check \\(value in \\(([^)]*)\\)\\)`,
    'i',
  ).exec(sql);
  if (!match?.[1]) throw new Error(`Domaine SQL introuvable : ${name}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
}

describe('statuts : TypeScript et SQL identiques', () => {
  it.each([
    ['user_role', ROLES],
    ['jobsite_status', JOBSITE_STATUSES],
    ['proof_slot_status', PROOF_SLOT_STATUSES],
    ['proof_phase', PROOF_PHASES],
    ['inspection_result', INSPECTION_RESULTS],
    ['work_type', WORK_TYPES],
  ] as const)('domaine %s', (domain, values) => {
    expect(domainValues(domain)).toEqual([...values]);
  });
});
