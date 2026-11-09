import type { ChecklistAnswers } from '@preuvio/shared';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { globalTemplatesSql, templateId } from './sql';

const MIGRATION = fileURLToPath(
  new URL('../../../supabase/migrations/20261108221805_global_templates_v1.sql', import.meta.url),
);

describe('migration des modèles globaux', () => {
  it('identifiants stables, au format UUID', () => {
    expect(templateId('PAC_AIR_EAU', '1.0.0')).toBe(templateId('PAC_AIR_EAU', '1.0.0'));
    expect(templateId('PAC_AIR_EAU', '1.0.0')).not.toBe(templateId('PAC_AIR_EAU', '1.0.1'));
    expect(templateId('X', '1.0.0')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('correspond aux fichiers JSON', () => {
    if (process.env.UPDATE_TEMPLATES_SQL) writeFileSync(MIGRATION, globalTemplatesSql());
    expect(readFileSync(MIGRATION, 'utf8')).toBe(globalTemplatesSql());
  });
});

describe('données de démonstration (supabase/seed.sql)', () => {
  it('les preuves de démonstration sont celles du modèle PAC, sans réponse', async () => {
    const { parseTemplate, planSlots } = await import('@preuvio/shared');
    const { globalTemplates } = await import('./index');
    const seed = readFileSync(
      fileURLToPath(new URL('../../../supabase/seed.sql', import.meta.url)),
      'utf8',
    );
    const pac = parseTemplate(
      globalTemplates.find((t) => (t as { code: string }).code === 'PAC_AIR_EAU'),
    );
    const expected = planSlots(pac, {}).map((p) => [
      p.itemKey,
      p.instruction,
      p.phase,
      p.position,
      p.required,
    ]);
    const rows = [
      ...seed.matchAll(
        /\('62000000-[^']+', '([^']+)', '((?:[^']|'')+)', '(\w+)', (\d+), (true|false)\)/g,
      ),
    ].map((m) => [m[1], m[2]!.replaceAll("''", "'"), m[3], Number(m[4]), m[5] === 'true']);
    expect(rows).toEqual(expected);
  });

  // Chantier d'exemple de référence (docs/chantier-exemple.md) : ses preuves suivent le moteur
  // pour ses réponses ; si un modèle change, ce test signale la fiche et le seed à mettre à jour.
  it('le chantier d’exemple a les preuves du moteur pour ses réponses', async () => {
    const { parseTemplate, planSlots } = await import('@preuvio/shared');
    const { globalTemplates } = await import('./index');
    const seed = readFileSync(
      fileURLToPath(new URL('../../../supabase/seed.sql', import.meta.url)),
      'utf8',
    );
    const operations: { id: string; code: string; answers: ChecklistAnswers }[] = [
      {
        id: 'bd6b702e-e194-4ce9-ad3b-95a03005de21',
        code: 'PAC_AIR_EAU',
        answers: { old_boiler_removed: true, indoor_units: 1 },
      },
      {
        id: '7c37abef-c22b-4467-95e8-7d5cb9aad697',
        code: 'COMBLES_PERDUS',
        answers: { zones: 2, hatch_present: true },
      },
    ];
    const rows = [
      ...seed.matchAll(
        /\('[0-9a-f-]{36}', '([0-9a-f-]{36})', '([^']+)', '((?:[^']|'')+)', '(\w+)', (\d+), (true|false)\)/g,
      ),
    ].map((m) => ({
      operationId: m[1],
      slot: [m[2], m[3]!.replaceAll("''", "'"), m[4], Number(m[5]), m[6] === 'true'],
    }));
    for (const op of operations) {
      expect(seed).toContain(`('${op.id}', '${op.code}', '${JSON.stringify(op.answers)}')`);
      const template = parseTemplate(
        globalTemplates.find((t) => (t as { code: string }).code === op.code),
      );
      const expected = planSlots(template, op.answers)
        .filter((p) => p.applicable)
        .map((p) => [p.itemKey, p.instruction, p.phase, p.position, p.required]);
      const actual = rows.filter((r) => r.operationId === op.id).map((r) => r.slot);
      expect(actual).toEqual(expected);
    }
  });
});
